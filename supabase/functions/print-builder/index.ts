import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { hashPrintDraftToken, recalculatePrintDraft, verifyPrintDraftAccess } from '../_shared/printDrafts.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const BUCKET = 'print-originals';
const PREVIEW_BUCKET = 'print-previews';
const MAX_FILE_SIZE = 35 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function createAccessToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeExtension(name: string, mimeType: string) {
  const extension = String(name || '').split('.').pop()?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension)) return extension;
  return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
}

function cleanCrop(value: unknown) {
  const crop = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    mode: crop.mode === 'fill' ? 'fill' : 'fit',
    zoom: Math.min(3, Math.max(1, Number(crop.zoom || 1))),
    x: Math.min(100, Math.max(0, Number(crop.x ?? 50))),
    y: Math.min(100, Math.max(0, Number(crop.y ?? 50))),
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();
  try {
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'create_draft') {
      const printSize = body?.printSize === 'A4' ? 'A4' : '4x6';
      const finish = body?.finish === 'matte' ? 'matte' : 'glossy';
      const defaultCopies = Math.min(999, Math.max(1, Math.floor(Number(body?.defaultCopies || 1))));
      const accessToken = createAccessToken();
      const { data: draft, error } = await supabase.from('print_drafts').insert({
        access_token_hash: await hashPrintDraftToken(accessToken),
        print_size: printSize,
        finish,
        default_copies: defaultCopies,
      }).select('*').single();
      if (error) throw error;
      return jsonResponse({ draft, accessToken });
    }

    const draft = await verifyPrintDraftAccess(supabase, String(body?.draftId || ''), String(body?.accessToken || ''));

    if (action === 'get_draft') {
      const { data: files, error } = await supabase
        .from('print_draft_files').select('*').eq('draft_id', draft.id).order('sort_order').order('created_at');
      if (error) throw error;
      const paths = (files || []).map((file: Record<string, unknown>) => String(file.preview_storage_path || '')).filter(Boolean);
      const previewByPath = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signedPreviews } = await supabase.storage.from(PREVIEW_BUCKET).createSignedUrls(paths, 600);
        (signedPreviews || []).forEach((item: { path?: string; signedUrl?: string }) => {
          if (item.path && item.signedUrl) previewByPath.set(item.path, item.signedUrl);
        });
      }
      return jsonResponse({
        draft,
        files: (files || []).map((file: Record<string, unknown>) => ({
          ...file,
          preview_url: previewByPath.get(String(file.preview_storage_path || '')) || null,
        })),
      });
    }

    if (action === 'request_upload') {
      const originalName = String(body?.file?.name || '').slice(0, 240);
      const mimeType = String(body?.file?.type || '').toLowerCase();
      const sizeBytes = Number(body?.file?.size || 0);
      if (!originalName || !ALLOWED_TYPES.has(mimeType)) return jsonResponse({ error: 'unsupported_file_type' }, 400);
      if (sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) return jsonResponse({ error: 'file_too_large' }, 400);
      const fileId = crypto.randomUUID();
      const storagePath = `${draft.id}/originals/${fileId}.${safeExtension(originalName, mimeType)}`;
      const previewStoragePath = `${draft.id}/previews/${fileId}.webp`;
      const { data: file, error: insertError } = await supabase.from('print_draft_files').insert({
        id: fileId,
        draft_id: draft.id,
        original_name: originalName,
        storage_path: storagePath,
        preview_storage_path: previewStoragePath,
        size_bytes: sizeBytes,
        mime_type: mimeType,
        copies: draft.default_copies,
        sort_order: Math.max(0, Math.floor(Number(body?.sortOrder || 0))),
      }).select('*').single();
      if (insertError) throw insertError;
      const { data: signedUpload, error: signedError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signedError) {
        await supabase.from('print_draft_files').delete().eq('id', fileId);
        throw signedError;
      }
      const { data: signedPreviewUpload, error: previewSignedError } = await supabase.storage.from(PREVIEW_BUCKET).createSignedUploadUrl(previewStoragePath);
      if (previewSignedError) {
        await supabase.from('print_draft_files').delete().eq('id', fileId);
        throw previewSignedError;
      }
      return jsonResponse({ file, upload: signedUpload, previewUpload: signedPreviewUpload });
    }

    const fileId = String(body?.fileId || '');
    const { data: file, error: fileError } = await supabase
      .from('print_draft_files').select('*').eq('id', fileId).eq('draft_id', draft.id).maybeSingle();
    if (fileError) throw fileError;
    if (!file) return jsonResponse({ error: 'print_file_not_found' }, 404);

    if (action === 'confirm_upload') {
      const parent = file.storage_path.split('/').slice(0, -1).join('/');
      const filename = file.storage_path.split('/').pop();
      const { data: objects, error: storageError } = await supabase.storage.from(BUCKET).list(parent, { search: filename, limit: 10 });
      if (storageError) throw storageError;
      if (!(objects || []).some((object: { name: string }) => object.name === filename)) {
        return jsonResponse({ error: 'uploaded_file_not_found' }, 409);
      }
      const { error: updateError } = await supabase.from('print_draft_files').update({
        width: Math.max(1, Math.floor(Number(body?.width || 1))),
        height: Math.max(1, Math.floor(Number(body?.height || 1))),
        resolution_status: body?.resolutionStatus === 'low' ? 'low' : 'good',
        upload_status: 'uploaded',
        updated_at: new Date().toISOString(),
      }).eq('id', file.id);
      if (updateError) throw updateError;
      return jsonResponse(await recalculatePrintDraft(supabase, draft.id));
    }

    if (action === 'update_file') {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body?.copies !== undefined) updates.copies = Math.min(999, Math.max(1, Math.floor(Number(body.copies || 1))));
      if (body?.rotation !== undefined) updates.rotation = [0, 90, 180, 270].includes(Number(body.rotation)) ? Number(body.rotation) : 0;
      if (body?.crop !== undefined) updates.crop = cleanCrop(body.crop);
      const { error } = await supabase.from('print_draft_files').update(updates).eq('id', file.id);
      if (error) throw error;
      return jsonResponse(await recalculatePrintDraft(supabase, draft.id));
    }

    if (action === 'remove_file') {
      await supabase.storage.from(BUCKET).remove([file.storage_path]);
      if (file.preview_storage_path) await supabase.storage.from(PREVIEW_BUCKET).remove([file.preview_storage_path]);
      const { error } = await supabase.from('print_draft_files').delete().eq('id', file.id);
      if (error) throw error;
      return jsonResponse(await recalculatePrintDraft(supabase, draft.id));
    }

    if (action === 'seal_draft') {
      const summary = await recalculatePrintDraft(supabase, draft.id);
      if (summary.draft.file_count < 1 || summary.draft.total_copies < 1) return jsonResponse({ error: 'print_draft_empty' }, 400);
      const { data: readyDraft, error } = await supabase.from('print_drafts').update({
        status: 'ready', updated_at: new Date().toISOString(),
      }).eq('id', draft.id).select('*').single();
      if (error) throw error;
      return jsonResponse({ draft: readyDraft, lowResolutionCount: summary.lowResolutionCount });
    }

    return jsonResponse({ error: 'unsupported_action' }, 400);
  } catch (error) {
    console.error('print-builder error:', error);
    const message = error instanceof Error ? error.message : 'print_builder_failed';
    const status = /not_found/.test(message) ? 404 : /access|expired|locked/.test(message) ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});

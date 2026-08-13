import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getPrintUnitPrice, hashPrintDraftToken, recalculatePrintDraft, verifyPrintDraftAccess } from '../_shared/printDrafts.ts';
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

function catalogUnitPrice(variant: Record<string, unknown>, settings: Record<string, unknown> | null, totalCopies = 1) {
  if (variant.is_available === false) return 0;
  if (variant.pricing_mode === 'fixed') return Number(Number(variant.unit_price || 0).toFixed(2));
  if (variant.pricing_mode === 'existing_a4') return Number(Number(settings?.a4_price || 0).toFixed(2));

  let price = Number(settings?.photo_4x6_price || 0);
  if (settings?.is_dynamic_pricing_enabled) {
    if (totalCopies <= Number(settings?.tier_1_limit || 0)) price = Number(settings?.tier_1_price || price);
    else if (totalCopies <= Number(settings?.tier_2_limit || 0)) price = Number(settings?.tier_2_price || price);
    else price = Number(settings?.tier_3_price || price);
  }
  return Number(price.toFixed(2));
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();
  try {
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'list_variants') {
      const { data: variants, error } = await supabase
        .from('print_variants')
        .select('id, print_size, material, surface, border_style, pricing_mode, unit_price, is_active, is_available, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('print_size');
      if (error) throw error;
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('a4_price, photo_4x6_price, is_dynamic_pricing_enabled, tier_1_limit, tier_1_price, tier_2_limit, tier_2_price, tier_3_price')
        .eq('id', 1)
        .maybeSingle();
      if (settingsError) throw settingsError;
      const pricedVariants = (variants || []).map((variant) => {
        const effectiveUnitPrice = catalogUnitPrice(variant, settings, 1);
        return {
          ...variant,
          effective_unit_price: effectiveUnitPrice,
          available: variant.is_available !== false && effectiveUnitPrice > 0,
        };
      });
      return jsonResponse({ variants: pricedVariants });
    }

    if (action === 'quote') {
      const variantId = String(body?.variantId || '');
      const totalCopies = Math.min(999999, Math.max(1, Math.floor(Number(body?.totalCopies || 1))));
      const { data: variant, error: variantError } = await supabase
        .from('print_variants')
        .select('id, print_size, is_active, is_available')
        .eq('id', variantId)
        .maybeSingle();
      if (variantError) throw variantError;
      if (!variant || !variant.is_active || variant.is_available === false) {
        return jsonResponse({ error: 'print_variant_unavailable' }, 409);
      }
      const unitPrice = await getPrintUnitPrice(supabase, variant.print_size, totalCopies, variant.id);
      return jsonResponse({
        totalCopies,
        unitPrice,
        subtotal: Number((unitPrice * totalCopies).toFixed(2)),
      });
    }

    if (action === 'create_draft') {
      const variantId = String(body?.variantId || '');
      const { data: variant, error: variantError } = await supabase
        .from('print_variants')
        .select('*')
        .eq('id', variantId)
        .eq('is_active', true)
        .eq('is_available', true)
        .maybeSingle();
      if (variantError) throw variantError;
      if (!variant) return jsonResponse({ error: 'print_variant_unavailable' }, 400);
      const fitMode = body?.fitMode === 'fit' ? 'fit' : 'fill';
      const defaultCopies = Math.min(999, Math.max(1, Math.floor(Number(body?.defaultCopies || 1))));
      await getPrintUnitPrice(supabase, variant.print_size, defaultCopies, variant.id);
      const { data: retentionSettings } = await supabase
        .from('settings')
        .select('print_draft_retention_days')
        .limit(1)
        .maybeSingle();
      const retentionDays = Math.min(30, Math.max(1, Number(retentionSettings?.print_draft_retention_days || 7)));
      const accessToken = createAccessToken();
      const { data: draft, error } = await supabase.from('print_drafts').insert({
        access_token_hash: await hashPrintDraftToken(accessToken),
        variant_id: variant.id,
        print_size: variant.print_size,
        finish: variant.surface === 'matte' ? 'matte' : 'glossy',
        material: variant.material,
        surface: variant.surface,
        border_style: variant.border_style,
        fit_mode: fitMode,
        default_copies: defaultCopies,
        expires_at: new Date(Date.now() + retentionDays * 86400000).toISOString(),
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

    if (action === 'seal_draft' && draft.status === 'ready' && draft.snapshot_at) {
      return jsonResponse({ draft });
    }

    if (draft.status === 'ready') {
      return jsonResponse({ error: 'print_draft_locked' }, 409);
    }

    if (action === 'update_draft') {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body?.variantId !== undefined) {
        const { data: variant, error: variantError } = await supabase
          .from('print_variants').select('*').eq('id', String(body.variantId)).eq('is_active', true).eq('is_available', true).maybeSingle();
        if (variantError) throw variantError;
        if (!variant) return jsonResponse({ error: 'print_variant_unavailable' }, 400);
        await getPrintUnitPrice(supabase, variant.print_size, Number(draft.total_copies || draft.default_copies || 1), variant.id);
        updates.variant_id = variant.id;
        updates.print_size = variant.print_size;
        updates.material = variant.material;
        updates.surface = variant.surface;
        updates.finish = variant.surface === 'matte' ? 'matte' : 'glossy';
        updates.border_style = variant.border_style;
      }
      if (body?.fitMode !== undefined) updates.fit_mode = body.fitMode === 'fit' ? 'fit' : 'fill';
      if (body?.defaultCopies !== undefined) {
        updates.default_copies = Math.min(999, Math.max(1, Math.floor(Number(body.defaultCopies || 1))));
      }
      const { data: updatedDraft, error } = await supabase
        .from('print_drafts').update(updates).eq('id', draft.id).select('*').single();
      if (error) throw error;
      if (body?.fitMode !== undefined) {
        const { data: files, error: filesError } = await supabase
          .from('print_draft_files').select('id, crop').eq('draft_id', draft.id);
        if (filesError) throw filesError;
        for (const file of files || []) {
          const crop = cleanCrop({ ...(file.crop || {}), mode: updatedDraft.fit_mode });
          const { error: cropError } = await supabase
            .from('print_draft_files').update({ crop, updated_at: new Date().toISOString() }).eq('id', file.id);
          if (cropError) throw cropError;
        }
      }
      return jsonResponse(await recalculatePrintDraft(supabase, draft.id));
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
        original_storage_path: storagePath,
        preview_storage_path: previewStoragePath,
        size_bytes: sizeBytes,
        mime_type: mimeType,
        copies: draft.default_copies,
        crop: { mode: draft.fit_mode === 'fit' ? 'fit' : 'fill', zoom: 1, x: 50, y: 50 },
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

    // Sealing applies to the complete draft, so it must not require a fileId.
    if (action === 'seal_draft') {
      if (body?.reviewConfirmed !== true) return jsonResponse({ error: 'print_review_confirmation_required' }, 400);
      const { data: uploadRows, error: uploadRowsError } = await supabase
        .from('print_draft_files').select('upload_status').eq('draft_id', draft.id);
      if (uploadRowsError) throw uploadRowsError;
      if ((uploadRows || []).some((file: { upload_status: string }) => file.upload_status !== 'uploaded')) {
        return jsonResponse({ error: 'print_uploads_incomplete' }, 409);
      }
      const summary = await recalculatePrintDraft(supabase, draft.id);
      if (summary.draft.file_count < 1 || summary.draft.total_copies < 1) {
        return jsonResponse({ error: 'print_draft_empty' }, 400);
      }
      const { data: readyDraft, error } = await supabase.from('print_drafts').update({
        status: 'ready',
        review_confirmed_at: new Date().toISOString(),
        snapshot_unit_price: summary.draft.unit_price,
        snapshot_subtotal: summary.draft.subtotal,
        snapshot_total_copies: summary.draft.total_copies,
        snapshot_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id).select('*').single();
      if (error) throw error;
      return jsonResponse({ draft: readyDraft });
    }

    const fileId = String(body?.fileId || '');
    const { data: file, error: fileError } = await supabase
      .from('print_draft_files').select('*').eq('id', fileId).eq('draft_id', draft.id).maybeSingle();
    if (fileError) throw fileError;
    if (!file) return jsonResponse({ error: 'print_file_not_found' }, 404);
    const originalStoragePath = file.original_storage_path || file.storage_path;

    if (action === 'confirm_upload') {
      const parent = originalStoragePath.split('/').slice(0, -1).join('/');
      const filename = originalStoragePath.split('/').pop();
      const { data: objects, error: storageError } = await supabase.storage.from(BUCKET).list(parent, { search: filename, limit: 10 });
      if (storageError) throw storageError;
      if (!(objects || []).some((object: { name: string }) => object.name === filename)) {
        return jsonResponse({ error: 'uploaded_file_not_found' }, 409);
      }
      const { error: updateError } = await supabase.from('print_draft_files').update({
        width: Math.max(1, Math.floor(Number(body?.width || 1))),
        height: Math.max(1, Math.floor(Number(body?.height || 1))),
        resolution_status: 'unknown',
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
      await supabase.storage.from(BUCKET).remove([originalStoragePath]);
      if (file.preview_storage_path) await supabase.storage.from(PREVIEW_BUCKET).remove([file.preview_storage_path]);
      const { error } = await supabase.from('print_draft_files').delete().eq('id', file.id);
      if (error) throw error;
      return jsonResponse(await recalculatePrintDraft(supabase, draft.id));
    }

    return jsonResponse({ error: 'unsupported_action' }, 400);
  } catch (error) {
    console.error('print-builder error:', error);
    const message = error instanceof Error ? error.message : 'print_builder_failed';
    const status = /not_found/.test(message) ? 404 : /access|expired|locked/.test(message) ? 403 : /unavailable/.test(message) ? 409 : 500;
    return jsonResponse({ error: message }, status);
  }
});

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const ORIGINAL_BUCKET = 'print-originals';
const PREVIEW_BUCKET = 'print-previews';

function isAuthorized(req: Request) {
  const expected = Deno.env.get('PRINT_FILE_CLEANUP_SECRET') || '';
  const supplied = req.headers.get('x-cleanup-secret') || '';
  return expected.length >= 24 && supplied === expected;
}

function chunks<T>(items: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!isAuthorized(req)) return jsonResponse({ error: 'unauthorized' }, 401);

  const supabase = getServiceClient();
  try {
    const now = new Date().toISOString();
    const { data: settings } = await supabase
      .from('settings')
      .select('print_draft_retention_days')
      .limit(1)
      .maybeSingle();
    const draftDays = Math.min(30, Math.max(1, Number(settings?.print_draft_retention_days || 7)));
    const staleDraftCutoff = new Date(Date.now() - draftDays * 86400000).toISOString();

    const { data: drafts, error: draftError } = await supabase
      .from('print_drafts')
      .select('id, store_order_id, status, created_at, expires_at, purge_after, purge_reason')
      .or(`purge_after.lte.${now},and(status.in.(draft,uploading,ready),created_at.lte.${staleDraftCutoff})`)
      .limit(100);
    if (draftError) throw draftError;

    let deletedDrafts = 0;
    let deletedFiles = 0;
    const failures: Array<{ draftId: string; error: string }> = [];

    for (const draft of drafts || []) {
      try {
        const { data: files, error: filesError } = await supabase
          .from('print_draft_files')
          .select('storage_path, preview_storage_path, size_bytes')
          .eq('draft_id', draft.id);
        if (filesError) throw filesError;

        const originals = (files || []).map((file) => file.storage_path).filter(Boolean);
        const previews = (files || []).map((file) => file.preview_storage_path).filter(Boolean);
        for (const batch of chunks(originals)) {
          const { error } = await supabase.storage.from(ORIGINAL_BUCKET).remove(batch);
          if (error) throw error;
        }
        for (const batch of chunks(previews)) {
          const { error } = await supabase.storage.from(PREVIEW_BUCKET).remove(batch);
          if (error) throw error;
        }

        const reason = draft.purge_reason || (draft.purge_after ? 'retention_period_ended' : 'abandoned_draft');
        const { error: logError } = await supabase.from('print_file_deletion_logs').insert({
          draft_id: draft.id,
          store_order_id: draft.store_order_id,
          file_count: (files || []).length,
          total_bytes: (files || []).reduce((sum, file) => sum + Number(file.size_bytes || 0), 0),
          reason,
        });
        if (logError) throw logError;

        const { error: deleteError } = await supabase.from('print_drafts').delete().eq('id', draft.id);
        if (deleteError) throw deleteError;
        deletedDrafts += 1;
        deletedFiles += (files || []).length;
      } catch (error) {
        failures.push({
          draftId: draft.id,
          error: error instanceof Error ? error.message : 'cleanup_failed',
        });
      }
    }

    return jsonResponse({ checked: (drafts || []).length, deletedDrafts, deletedFiles, failures });
  } catch (error) {
    console.error('print-file-cleanup error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'cleanup_failed' }, 500);
  }
});

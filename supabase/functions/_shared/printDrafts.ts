export async function hashPrintDraftToken(token: string) {
  const bytes = new TextEncoder().encode(String(token || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPrintDraftAccess(
  supabase: any,
  draftId: string,
  accessToken: string,
  options: { allowOrdered?: boolean } = {},
) {
  if (!draftId || !accessToken) throw new Error('print_draft_access_required');
  const { data: draft, error } = await supabase
    .from('print_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw error;
  if (!draft) throw new Error('print_draft_not_found');
  const tokenHash = await hashPrintDraftToken(accessToken);
  if (tokenHash !== draft.access_token_hash) throw new Error('print_draft_access_denied');
  if (new Date(draft.expires_at).getTime() <= Date.now()) throw new Error('print_draft_expired');
  if (!options.allowOrdered && ['ordered', 'cancelled', 'expired'].includes(String(draft.status))) {
    throw new Error('print_draft_locked');
  }
  return draft;
}

export async function getPrintUnitPrice(supabase: any, printSize: string, totalCopies: number) {
  const { data: settings, error } = await supabase
    .from('settings')
    .select('a4_price, photo_4x6_price, is_dynamic_pricing_enabled, tier_1_limit, tier_1_price, tier_2_limit, tier_2_price, tier_3_price')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  if (printSize === 'A4') return Number(Number(settings?.a4_price || 0).toFixed(2));
  let price = Number(settings?.photo_4x6_price || 0);
  if (settings?.is_dynamic_pricing_enabled) {
    if (totalCopies <= Number(settings?.tier_1_limit || 0)) price = Number(settings?.tier_1_price || price);
    else if (totalCopies <= Number(settings?.tier_2_limit || 0)) price = Number(settings?.tier_2_price || price);
    else price = Number(settings?.tier_3_price || price);
  }
  return Number(price.toFixed(2));
}

export async function recalculatePrintDraft(supabase: any, draftId: string) {
  const { data: draft, error: draftError } = await supabase
    .from('print_drafts')
    .select('id, print_size, status')
    .eq('id', draftId)
    .single();
  if (draftError) throw draftError;

  const { data: files, error: filesError } = await supabase
    .from('print_draft_files')
    .select('copies, resolution_status')
    .eq('draft_id', draftId)
    .eq('upload_status', 'uploaded');
  if (filesError) throw filesError;

  const fileCount = files?.length || 0;
  const totalCopies = (files || []).reduce((sum: number, file: any) => sum + Number(file.copies || 0), 0);
  const unitPrice = await getPrintUnitPrice(supabase, draft.print_size, totalCopies);
  const subtotal = Number((unitPrice * totalCopies).toFixed(2));
  const nextStatus = draft.status === 'ready' && fileCount > 0 ? 'ready' : fileCount > 0 ? 'uploading' : 'draft';
  const { data: updated, error: updateError } = await supabase
    .from('print_drafts')
    .update({
      file_count: fileCount,
      total_copies: totalCopies,
      unit_price: unitPrice,
      subtotal,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  return { draft: updated, lowResolutionCount: (files || []).filter((file: any) => file.resolution_status === 'low').length };
}

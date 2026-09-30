import { supabase } from '../lib/supabase';

export const RECEIPT_STATUS_META = {
  draft: { label: 'مسودة', className: 'bg-slate-100 text-slate-600' },
  issued: { label: 'صادر', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'ملغي', className: 'bg-red-50 text-red-600' },
};

export async function invokeReceipt(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('تتطلب العملية جلسة إدارة صالحة');
  const { data, error } = await supabase.functions.invoke('receipt-api', {
    headers: { Authorization: 'Bearer ' + accessToken },
    body,
  });
  if (error) {
    let message = error.message || 'تعذر تنفيذ العملية';
    try { message = (await error.context?.clone?.().json?.())?.error || message; } catch { /* no-op */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function formatOrderReference(value) {
  const normalized = String(value || '').trim().replace(/^AM-/i, '').slice(0, 12).toUpperCase();
  return normalized ? `AM-${normalized}` : '';
}

export function receiptOrderLabel(receipt) {
  if (!receipt.order_type) return 'غير مرتبط بطلب';
  const reference = receipt.order_reference
    || formatOrderReference(receipt.order?.short_id || receipt.print_order_id || receipt.store_order_id);
  return `${receipt.order_type === 'store' ? 'طلب متجر' : 'طلب طباعة'} ${reference}`;
}

export async function downloadReceipt(receipt) {
  const { url } = await invokeReceipt({ action: 'download_url', receiptId: receipt.id });
  const response = await fetch(url);
  if (!response.ok) throw new Error('تعذر تنزيل ملف الإيصال');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${receipt.receipt_number}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function maskCustomerName(value: unknown) {
  const parts = clean(value, 160).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'عميل لحظة فن';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json();
    const receiptNumber = clean(body?.receiptNumber, 40).toUpperCase();
    const verificationToken = clean(body?.verificationToken, 80);
    if (!/^RC-\d{4}-\d{5}$/.test(receiptNumber)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(verificationToken)) {
      return jsonResponse({ valid: false }, 404);
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase.from('receipts')
      .select('receipt_number, verification_code, customer_id, amount, currency, payment_method, payment_date, status, issued_at, cancelled_at')
      .eq('receipt_number', receiptNumber)
      .eq('verification_token', verificationToken)
      .in('status', ['issued', 'cancelled'])
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ valid: false }, 404);

    const { data: customer, error: customerError } = await supabase
      .from('customers').select('name').eq('id', data.customer_id).maybeSingle();
    if (customerError) throw customerError;

    return jsonResponse({
      valid: true,
      receipt: {
        receiptNumber: data.receipt_number,
        verificationCode: data.verification_code,
        customerName: maskCustomerName(customer?.name),
        amount: Number(data.amount),
        currency: data.currency,
        paymentMethod: data.payment_method,
        paymentDate: data.payment_date,
        status: data.status,
        issuedAt: data.issued_at,
        cancelledAt: data.cancelled_at,
      },
    });
  } catch (error) {
    console.error('receipt-public-api error:', error);
    return jsonResponse({ error: 'verification_unavailable' }, 500);
  }
});
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { sendWhatsAppReceiptTemplate } from '../_shared/whatsapp.ts';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearerToken(req: Request) {
  return (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

async function getAdminActor(req: Request, supabase: ReturnType<typeof getServiceClient>) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: admins, error: adminError } = await supabase.from('admin_users').select('user_id, email');
  if (adminError) throw adminError;
  const email = String(data.user.email || '').toLowerCase();
  const allowed = !admins?.length || admins.some((admin: Record<string, unknown>) => (
    String(admin.user_id || '') === data.user.id
    || String(admin.email || '').toLowerCase() === email
  ));
  return allowed ? { id: data.user.id, email } : null;
}

function decodeBase64(value: unknown) {
  const raw = String(value || '').replace(/^data:application\/pdf;base64,/, '');
  if (!raw || raw.length > 14_000_000) throw new Error('invalid_pdf');
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function maskCustomerName(value: unknown) {
  const parts = clean(value, 160).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'عميل لحظة فن';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

async function getReceiptContext(supabase: ReturnType<typeof getServiceClient>, receiptId: string) {
  const { data: receipt, error } = await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle();
  if (error) throw error;
  if (!receipt) throw new Error('receipt_not_found');
  const { data: customer, error: customerError } = await supabase
    .from('customers').select('id, name, phone').eq('id', receipt.customer_id).maybeSingle();
  if (customerError) throw customerError;
  if (!customer) throw new Error('customer_not_found');
  return { receipt, customer };
}

async function createSignedReceiptUrl(supabase: ReturnType<typeof getServiceClient>, path: string) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60 * 6);
  if (error) throw error;
  return data.signedUrl;
}

async function sendReceipt(supabase: ReturnType<typeof getServiceClient>, receiptId: string) {
  const { receipt, customer } = await getReceiptContext(supabase, receiptId);
  if (receipt.status !== 'issued' || !receipt.pdf_path) throw new Error('receipt_not_issued');
  const documentUrl = await createSignedReceiptUrl(supabase, receipt.pdf_path);
  try {
    const result = await sendWhatsAppReceiptTemplate(supabase, {
      to: customer.phone,
      customerName: customer.name,
      receiptNumber: receipt.receipt_number,
      amountLabel: `${Number(receipt.amount).toFixed(2)} ر.س`,
      paymentDate: receipt.payment_date,
      documentUrl,
    });
    if (result.skipped) {
      await supabase.from('receipts').update({
        whatsapp_status: 'failed', whatsapp_error: result.reason || 'whatsapp_disabled',
      }).eq('id', receipt.id);
      return result;
    }
    await supabase.from('receipts').update({
      whatsapp_status: 'sent', whatsapp_sent_at: new Date().toISOString(),
      whatsapp_provider_id: result.providerMessageId || null, whatsapp_error: null,
    }).eq('id', receipt.id);
    await supabase.from('customer_message_logs').insert({
      customer_id: receipt.customer_id, channel: 'whatsapp', type: 'receipt',
      subject: `إيصال قبض ${receipt.receipt_number}`,
      body: `${Number(receipt.amount).toFixed(2)} ر.س`, status: 'sent',
      sent_at: new Date().toISOString(), provider_id: result.providerMessageId || null,
      metadata: { receiptId: receipt.id, receiptNumber: receipt.receipt_number },
    });
    return result;
  } catch (error) {
    await supabase.from('receipts').update({
      whatsapp_status: 'failed', whatsapp_error: error instanceof Error ? error.message : 'send_failed',
    }).eq('id', receipt.id);
    throw error;
  }
}

async function enrichReceipts(supabase: ReturnType<typeof getServiceClient>, receipts: Record<string, unknown>[]) {
  const customerIds = [...new Set(receipts.map((row) => clean(row.customer_id, 80)).filter(Boolean))];
  const printIds = [...new Set(receipts.map((row) => clean(row.print_order_id, 80)).filter(Boolean))];
  const storeIds = [...new Set(receipts.map((row) => clean(row.store_order_id, 80)).filter(Boolean))];
  const [{ data: customers }, { data: printOrders }, { data: storeOrders }] = await Promise.all([
    customerIds.length ? supabase.from('customers').select('id, name, phone').in('id', customerIds) : Promise.resolve({ data: [] }),
    printIds.length ? supabase.from('orders').select('id, customer_name, total_amount').in('id', printIds) : Promise.resolve({ data: [] }),
    storeIds.length ? supabase.from('store_orders').select('id, short_id, customer_name, total_amount, delivery_fee').in('id', storeIds) : Promise.resolve({ data: [] }),
  ]);
  const customerMap = new Map((customers || []).map((row: Record<string, unknown>) => [row.id, row]));
  const printMap = new Map((printOrders || []).map((row: Record<string, unknown>) => [row.id, row]));
  const storeMap = new Map((storeOrders || []).map((row: Record<string, unknown>) => [row.id, row]));
  return receipts.map((receipt) => ({
    ...receipt,
    customer: customerMap.get(receipt.customer_id) || null,
    order: receipt.order_type === 'print'
      ? printMap.get(receipt.print_order_id) || null
      : receipt.order_type === 'store' ? storeMap.get(receipt.store_order_id) || null : null,
  }));
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();
  try {
    const body = await req.json();
    const action = clean(body?.action, 60);

    if (action === 'verify') {
      const receiptNumber = clean(body?.receiptNumber, 40);
      const verificationToken = clean(body?.verificationToken, 80);
      if (!receiptNumber || !verificationToken) return jsonResponse({ error: 'verification_data_required' }, 400);
      const { data, error } = await supabase.from('receipts')
        .select('receipt_number, customer_id, amount, currency, payment_method, payment_date, status, issued_at, cancelled_at')
        .eq('receipt_number', receiptNumber).eq('verification_token', verificationToken).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ valid: false }, 404);
      const { data: customer } = await supabase.from('customers').select('name').eq('id', data.customer_id).maybeSingle();
      return jsonResponse({
        valid: true,
        receipt: {
          receiptNumber: data.receipt_number,
          customerName: maskCustomerName(customer?.name),
          amount: Number(data.amount), currency: data.currency,
          paymentMethod: data.payment_method, paymentDate: data.payment_date,
          status: data.status, issuedAt: data.issued_at, cancelledAt: data.cancelled_at,
        },
      });
    }

    const actor = await getAdminActor(req, supabase);
    if (!actor) return jsonResponse({ error: 'not_authorized' }, 403);

    if (action === 'list') {
      let query = supabase.from('receipts').select('*').order('created_at', { ascending: false }).limit(500);
      if (body?.customerId) query = query.eq('customer_id', clean(body.customerId, 80));
      if (body?.orderType === 'print' && body?.orderId) query = query.eq('print_order_id', clean(body.orderId, 80));
      if (body?.orderType === 'store' && body?.orderId) query = query.eq('store_order_id', clean(body.orderId, 80));
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ receipts: await enrichReceipts(supabase, data || []) });
    }

    if (action === 'customer_context') {
      const customerId = clean(body?.customerId, 80);
      if (!customerId) return jsonResponse({ error: 'customer_id_required' }, 400);
      const [{ data: customer }, { data: printOrders }, { data: storeOrders }, { data: receipts }] = await Promise.all([
        supabase.from('customers').select('id, name, phone').eq('id', customerId).maybeSingle(),
        supabase.from('orders').select('id, customer_name, total_amount, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
        supabase.from('store_orders').select('id, short_id, customer_name, total_amount, delivery_fee, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
        supabase.from('receipts').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
      ]);
      if (!customer) return jsonResponse({ error: 'customer_not_found' }, 404);
      return jsonResponse({ customer, printOrders: printOrders || [], storeOrders: storeOrders || [], receipts: await enrichReceipts(supabase, receipts || []) });
    }

    if (action === 'create') {
      const customerId = clean(body?.customerId, 80);
      const issueRequestId = clean(body?.issueRequestId, 80);
      const amount = Number(body?.amount);
      const paymentMethod = clean(body?.paymentMethod, 40);
      const orderType = ['print', 'store'].includes(body?.orderType) ? body.orderType : null;
      const orderId = clean(body?.orderId, 80) || null;
      if (!customerId) return jsonResponse({ error: 'customer_id_required' }, 400);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueRequestId)) {
        return jsonResponse({ error: 'invalid_issue_request_id' }, 400);
      }
      if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ error: 'invalid_amount' }, 400);
      if (!['cash', 'bank_transfer'].includes(paymentMethod)) return jsonResponse({ error: 'invalid_payment_method' }, 400);
      if (orderType && !orderId) return jsonResponse({ error: 'order_id_required' }, 400);
      if (paymentMethod === 'bank_transfer' && !clean(body?.bankName, 160)) return jsonResponse({ error: 'bank_name_required' }, 400);
      const { data: customer } = await supabase.from('customers').select('id').eq('id', customerId).maybeSingle();
      if (!customer) return jsonResponse({ error: 'customer_not_found' }, 404);
      const { data: existingReceipt, error: existingError } = await supabase.from('receipts')
        .select('*').eq('issue_request_id', issueRequestId).maybeSingle();
      if (existingError) throw existingError;
      if (existingReceipt) {
        if (existingReceipt.customer_id !== customerId) return jsonResponse({ error: 'issue_request_conflict' }, 409);
        return jsonResponse({ receipt: existingReceipt, reused: true });
      }
      if (orderType) {
        const table = orderType === 'print' ? 'orders' : 'store_orders';
        const { data: order } = await supabase.from(table).select('id, customer_id').eq('id', orderId).maybeSingle();
        if (!order || order.customer_id !== customerId) return jsonResponse({ error: 'order_customer_mismatch' }, 400);
      }
      const payload = {
        issue_request_id: issueRequestId,
        customer_id: customerId,
        order_type: orderType,
        print_order_id: orderType === 'print' ? orderId : null,
        store_order_id: orderType === 'store' ? orderId : null,
        amount: Number(amount.toFixed(2)), currency: 'SAR', payment_method: paymentMethod,
        bank_name: paymentMethod === 'bank_transfer' ? clean(body?.bankName, 160) : null,
        transfer_reference: paymentMethod === 'bank_transfer' ? clean(body?.transferReference, 160) || null : null,
        payment_date: clean(body?.paymentDate, 20) || new Date().toISOString().slice(0, 10),
        description: clean(body?.description, 1000) || 'دفعة مستلمة',
        notes: clean(body?.notes, 2000) || null,
        status: 'draft', created_by: actor.id,
      };
      const { data, error } = await supabase.from('receipts').insert(payload).select('*').single();
      if (error?.code === '23505') {
        const { data: racedReceipt, error: racedError } = await supabase.from('receipts')
          .select('*').eq('issue_request_id', issueRequestId).maybeSingle();
        if (racedError) throw racedError;
        if (racedReceipt?.customer_id === customerId) return jsonResponse({ receipt: racedReceipt, reused: true });
      }
      if (error) throw error;
      return jsonResponse({ receipt: data });
    }

    if (action === 'issue') {
      const receiptId = clean(body?.receiptId, 80);
      const { receipt } = await getReceiptContext(supabase, receiptId);
      if (receipt.status !== 'draft') return jsonResponse({ error: 'receipt_not_draft' }, 409);
      const bytes = decodeBase64(body?.pdfBase64);
      const year = String(receipt.receipt_number).slice(3, 7);
      const path = `${year}/${receipt.receipt_number}.pdf`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, bytes, {
        contentType: 'application/pdf', upsert: true,
      });
      if (uploadError) throw uploadError;
      const issuedAt = new Date().toISOString();
      const { data, error } = await supabase.from('receipts').update({
        status: 'issued', pdf_path: path, issued_at: issuedAt,
      }).eq('id', receiptId).eq('status', 'draft').select('*').single();
      if (error) throw error;
      let whatsapp = null;
      let whatsappError = null;
      if (body?.sendWhatsApp === true) {
        try { whatsapp = await sendReceipt(supabase, receiptId); }
        catch (sendError) { whatsappError = sendError instanceof Error ? sendError.message : 'send_failed'; }
      }
      return jsonResponse({ receipt: data, whatsapp, whatsappError });
    }

    if (action === 'resend') {
      const receiptId = clean(body?.receiptId, 80);
      const result = await sendReceipt(supabase, receiptId);
      return jsonResponse({ ok: true, result });
    }

    if (action === 'download_url') {
      const { receipt } = await getReceiptContext(supabase, clean(body?.receiptId, 80));
      if (!receipt.pdf_path) return jsonResponse({ error: 'receipt_pdf_missing' }, 404);
      return jsonResponse({ url: await createSignedReceiptUrl(supabase, receipt.pdf_path) });
    }

    if (action === 'cancel') {
      const receiptId = clean(body?.receiptId, 80);
      const reason = clean(body?.reason, 500);
      if (!reason) return jsonResponse({ error: 'cancellation_reason_required' }, 400);
      const { receipt } = await getReceiptContext(supabase, receiptId);
      if (receipt.status !== 'issued') return jsonResponse({ error: 'only_issued_receipt_can_be_cancelled' }, 409);
      const { data, error } = await supabase.from('receipts').update({
        status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: reason,
      }).eq('id', receiptId).eq('status', 'issued').select('*').single();
      if (error) throw error;
      return jsonResponse({ receipt: data });
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('receipt-api error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'receipt_api_failed' }, 500);
  }
});
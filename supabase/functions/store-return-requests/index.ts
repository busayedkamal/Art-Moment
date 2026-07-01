import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const RETURN_STATUS_LABELS: Record<string, string> = {
  new_request: 'طلب استرجاع جديد',
  under_review: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  awaiting_item: 'بانتظار استلام المنتج',
  item_received: 'تم الاستلام',
  refunded: 'تم رد المبلغ',
};

const ALLOWED_RETURN_STATUSES = new Set(Object.keys(RETURN_STATUS_LABELS));
const CLOSED_ORDER_STATUSES = new Set(['cancelled', 'returned']);

function normalizeReturnItem(item: Record<string, unknown>) {
  const product = Array.isArray(item.products) ? item.products[0] : item.products;
  return {
    id: item.id,
    storeOrderItemId: item.store_order_item_id,
    productId: item.product_id,
    name: (product as Record<string, unknown> | undefined)?.name || 'منتج غير متاح',
    image: (product as Record<string, unknown> | undefined)?.image || null,
    quantity: Number(item.quantity || 0),
    price: Number(item.price_at_time || 0),
  };
}

function normalizeReturnRequest(request: Record<string, unknown>) {
  const items = Array.isArray(request.store_return_request_items)
    ? request.store_return_request_items.map((item) => normalizeReturnItem(item as Record<string, unknown>))
    : [];

  return {
    id: request.id,
    orderId: request.store_order_id,
    status: request.status || 'new_request',
    statusLabel: RETURN_STATUS_LABELS[String(request.status || 'new_request')] || String(request.status || ''),
    reason: request.reason,
    details: request.details || null,
    imageUrl: request.image_url || null,
    requestedRefundAmount: Number(request.requested_refund_amount || 0),
    approvedRefundAmount: Number(request.approved_refund_amount || 0),
    adminNote: request.admin_note || null,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    statusUpdatedAt: request.status_updated_at || null,
    items,
  };
}

function sameCustomerPhone(left: unknown, right: unknown) {
  const leftValues = phoneVariants(left);
  const rightValues = phoneVariants(right);
  return leftValues.some((value) => rightValues.includes(value));
}

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function isAdminRequest(req: Request, supabase: ReturnType<typeof getServiceClient>) {
  const token = getBearerToken(req);
  if (!token) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return false;

  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, email');
  if (adminError) throw adminError;

  if (!admins || admins.length === 0) return true;
  const userEmail = String(user.email || '').toLowerCase();
  return admins.some((admin: Record<string, unknown>) => (
    String(admin.user_id || '') === user.id
    || String(admin.email || '').toLowerCase() === userEmail
  ));
}

async function notifyCustomer(
  email: unknown,
  subject: string,
  title: string,
  body: string,
  requestId: unknown,
) {
  const to = String(email || '').trim();
  if (!to) return;

  await sendEmail({
    to,
    subject,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A">
        <h2 style="margin:0 0 12px;color:#4A4A4A">${title}</h2>
        <p style="margin:0 0 16px">${body}</p>
        <p style="margin:0;color:#999;font-size:13px">رقم طلب الاسترجاع: ${String(requestId).slice(0, 8)}</p>
      </div>
    `,
    text: `${title}\n${body}\nرقم طلب الاسترجاع: ${String(requestId).slice(0, 8)}`,
    tags: [{ name: 'type', value: 'store_return_request' }],
  });
}

async function fetchCustomerBySession(supabase: ReturnType<typeof getServiceClient>, sessionToken: unknown) {
  const tokenPayload = await verifyCustomerSessionToken(sessionToken);
  if (!tokenPayload?.sub) return null;

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .eq('id', tokenPayload.sub)
    .maybeSingle();
  if (error) throw error;
  return customer as Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || 'create');
    const supabase = getServiceClient();

    if (action === 'admin_update') {
      if (!await isAdminRequest(req, supabase)) {
        return jsonResponse({ error: 'unauthorized' }, 401);
      }

      const requestId = String(body?.returnRequestId || '').trim();
      const status = String(body?.status || '').trim();
      if (!requestId || !ALLOWED_RETURN_STATUSES.has(status)) {
        return jsonResponse({ error: 'invalid_return_status' }, 400);
      }

      const { data: existingRequest, error: requestError } = await supabase
        .from('store_return_requests')
        .select('*, store_return_request_items(id, store_order_item_id, product_id, quantity, price_at_time, products(name, image))')
        .eq('id', requestId)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!existingRequest) return jsonResponse({ error: 'return_request_not_found' }, 404);

      const approvedRefundAmount = Math.max(
        0,
        Number(body?.approvedRefundAmount ?? existingRequest.approved_refund_amount ?? existingRequest.requested_refund_amount ?? 0),
      );

      const updatePayload: Record<string, unknown> = {
        status,
        admin_note: String(body?.adminNote || '').trim() || null,
        status_updated_at: new Date().toISOString(),
      };
      if (status === 'refunded' || approvedRefundAmount > 0) {
        updatePayload.approved_refund_amount = approvedRefundAmount;
      }

      const { data: updatedRequest, error: updateError } = await supabase
        .from('store_return_requests')
        .update(updatePayload)
        .eq('id', requestId)
        .select('*, store_return_request_items(id, store_order_item_id, product_id, quantity, price_at_time, products(name, image))')
        .single();
      if (updateError) throw updateError;

      const { data: order, error: orderError } = await supabase
        .from('store_orders')
        .select('id, total_amount, delivery_fee, amount_paid, payment_status, refunded_amount')
        .eq('id', existingRequest.store_order_id)
        .maybeSingle();
      if (orderError) throw orderError;

      let orderPatch: Record<string, unknown> | null = null;
      if (order) {
        const { data: refundRequests, error: refundError } = await supabase
          .from('store_return_requests')
          .select('approved_refund_amount, requested_refund_amount, status')
          .eq('store_order_id', order.id);
        if (refundError) throw refundError;

        const totalRefunded = (refundRequests || []).reduce((sum: number, item: Record<string, unknown>) => {
          if (item.status !== 'refunded') return sum;
          return sum + Number(item.approved_refund_amount || item.requested_refund_amount || 0);
        }, 0);

        const orderTotal = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
        const paid = Number(order.amount_paid || 0);
        const nextPaymentStatus = totalRefunded > 0
          ? (orderTotal > 0 && totalRefunded >= orderTotal ? 'full_refund' : 'partial_refund')
          : (paid >= orderTotal && orderTotal > 0 ? 'paid' : paid > 0 ? 'awaiting_review' : 'pending_payment');

        orderPatch = {
          refunded_amount: totalRefunded,
          payment_status: nextPaymentStatus,
          payment_updated_at: new Date().toISOString(),
        };

        const { error: orderUpdateError } = await supabase
          .from('store_orders')
          .update(orderPatch)
          .eq('id', order.id);
        if (orderUpdateError) throw orderUpdateError;
      }

      if (existingRequest.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('email, name')
          .eq('id', existingRequest.customer_id)
          .maybeSingle();

        try {
          await notifyCustomer(
            customer?.email,
            'تحديث طلب الاسترجاع - لحظة فن',
            `تحديث طلب الاسترجاع: ${RETURN_STATUS_LABELS[status]}`,
            String(body?.adminNote || '').trim() || 'تم تحديث حالة طلب الاسترجاع الخاص بك. يمكنك متابعة التفاصيل من صفحة طلباتي.',
            updatedRequest.id,
          );
        } catch (emailError) {
          console.error('return status email error:', emailError);
        }
      }

      return jsonResponse({
        returnRequest: normalizeReturnRequest(updatedRequest as Record<string, unknown>),
        orderPatch,
      });
    }

    const customer = await fetchCustomerBySession(supabase, body?.sessionToken);
    if (!customer) return jsonResponse({ error: 'unauthorized' }, 401);

    const orderId = String(body?.orderId || '').trim();
    const reason = String(body?.reason || '').trim();
    const details = String(body?.details || '').trim();
    const imageUrl = String(body?.imageUrl || '').trim();
    const requestedItems = Array.isArray(body?.items) ? body.items : [];

    if (!orderId || reason.length < 3) {
      return jsonResponse({ error: 'invalid_return_request' }, 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('store_orders')
      .select('id, short_id, customer_id, customer_name, phone, status, total_amount, amount_paid, store_order_items(id, product_id, quantity, price_at_time, products(name, image))')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'order_not_found' }, 404);

    const ownsById = order.customer_id && String(order.customer_id) === String(customer.id);
    const ownsByPhone = sameCustomerPhone(order.phone, customer.phone);
    if (!ownsById && !ownsByPhone) return jsonResponse({ error: 'unauthorized' }, 401);
    if (CLOSED_ORDER_STATUSES.has(String(order.status || ''))) {
      return jsonResponse({ error: 'return_not_available' }, 409);
    }

    const { data: activeRequest, error: activeError } = await supabase
      .from('store_return_requests')
      .select('id, status')
      .eq('store_order_id', order.id)
      .not('status', 'in', '(rejected,refunded)')
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    if (activeRequest) return jsonResponse({ error: 'active_return_request_exists' }, 409);

    const orderItems = Array.isArray(order.store_order_items) ? order.store_order_items : [];
    const orderItemById = new Map(orderItems.map((item: Record<string, unknown>) => [String(item.id), item]));
    const returnItems = requestedItems
      .map((item: Record<string, unknown>) => {
        const orderItem = orderItemById.get(String(item.storeOrderItemId || item.id || ''));
        if (!orderItem) return null;
        const maxQuantity = Number(orderItem.quantity || 0);
        const quantity = Math.min(maxQuantity, Math.max(1, Number(item.quantity || 1)));
        if (quantity <= 0) return null;
        return {
          store_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          quantity,
          price_at_time: Number(orderItem.price_at_time || 0),
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (returnItems.length === 0) return jsonResponse({ error: 'invalid_return_items' }, 400);

    const requestedRefundAmount = returnItems.reduce(
      (sum, item) => sum + Number(item.price_at_time || 0) * Number(item.quantity || 0),
      0,
    );

    const { data: returnRequest, error: createError } = await supabase
      .from('store_return_requests')
      .insert({
        store_order_id: order.id,
        customer_id: customer.id,
        customer_name: customer.name || order.customer_name || null,
        phone: customer.phone || order.phone || null,
        reason,
        details: details || null,
        image_url: imageUrl || null,
        status: 'new_request',
        requested_refund_amount: requestedRefundAmount,
        approved_refund_amount: 0,
        status_updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (createError) throw createError;

    const { error: itemsError } = await supabase
      .from('store_return_request_items')
      .insert(returnItems.map((item) => ({
        ...item,
        return_request_id: returnRequest.id,
      })));
    if (itemsError) throw itemsError;

    const { data: createdRequest, error: createdFetchError } = await supabase
      .from('store_return_requests')
      .select('*, store_return_request_items(id, store_order_item_id, product_id, quantity, price_at_time, products(name, image))')
      .eq('id', returnRequest.id)
      .single();
    if (createdFetchError) throw createdFetchError;

    try {
      await notifyCustomer(
        customer.email,
        'تم استلام طلب الاسترجاع - لحظة فن',
        'تم استلام طلب الاسترجاع',
        'وصل طلب الاسترجاع إلى فريق لحظة فن، وسيتم مراجعته وتحديث حالته من صفحة طلباتي.',
        returnRequest.id,
      );
    } catch (emailError) {
      console.error('return request email error:', emailError);
    }

    const adminEmail = Deno.env.get('RETURN_REQUEST_NOTIFY_EMAIL') || Deno.env.get('ADMIN_NOTIFY_EMAIL');
    if (adminEmail) {
      try {
        await notifyCustomer(
          adminEmail,
          'طلب استرجاع جديد - لحظة فن',
          'طلب استرجاع جديد',
          `طلب متجر #${String(order.short_id || order.id).slice(0, 8)} يحتاج مراجعة.`,
          returnRequest.id,
        );
      } catch (emailError) {
        console.error('return admin email error:', emailError);
      }
    }

    return jsonResponse({
      returnRequest: normalizeReturnRequest(createdRequest as Record<string, unknown>),
    });
  } catch (error) {
    console.error('store-return-requests error:', error);
    const message = error instanceof Error ? error.message : 'return_request_failed';
    return jsonResponse({ error: message }, 500);
  }
});

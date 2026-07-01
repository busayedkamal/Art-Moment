import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function normalizeOrderItem(item: Record<string, unknown>) {
  const product = Array.isArray(item.products) ? item.products[0] : item.products;
  return {
    id: item.id,
    productId: item.product_id,
    name: (product as Record<string, unknown> | undefined)?.name || 'منتج غير متاح',
    image: (product as Record<string, unknown> | undefined)?.image || null,
    quantity: Number(item.quantity || 0),
    price: Number(item.price_at_time || 0),
  };
}

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

function normalizeOrder(order: Record<string, unknown>) {
  const items = Array.isArray(order.store_order_items)
    ? order.store_order_items.map((item) => normalizeOrderItem(item as Record<string, unknown>))
    : [];
  const returnRequests = Array.isArray(order.store_return_requests)
    ? order.store_return_requests.map((request) => normalizeReturnRequest(request as Record<string, unknown>))
    : [];

  return {
    id: order.id,
    shortId: order.short_id || String(order.id || '').slice(0, 6),
    status: order.status || 'pending_verification',
    customerName: order.customer_name || null,
    totalAmount: Number(order.total_amount || 0),
    amountPaid: Number(order.amount_paid || 0),
    deliveryFee: Number(order.delivery_fee || 0),
    paymentStatus: order.payment_status || null,
    paymentMethod: order.payment_method || null,
    paymentReference: order.payment_reference || null,
    refundedAmount: Number(order.refunded_amount || 0),
    paymentUpdatedAt: order.payment_updated_at || null,
    city: order.city || null,
    district: order.district || null,
    street: order.street || null,
    notes: order.notes || null,
    trackingNumber: order.tracking_number || null,
    courierName: order.courier_name || null,
    createdAt: order.created_at,
    updatedAt: order.updated_at || null,
    items,
    returnRequests,
  };
}

function mergeOrders(...groups: Array<Record<string, unknown>[]>) {
  const map = new Map<string, Record<string, unknown>>();
  groups.flat().forEach((order) => {
    if (order?.id) map.set(String(order.id), order);
  });
  return [...map.values()].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );
}

async function fetchReturnRequestsMap(
  supabase: ReturnType<typeof getServiceClient>,
  orderIds: string[],
) {
  if (orderIds.length === 0) return new Map<string, Record<string, unknown>[]>();

  const { data, error } = await supabase
    .from('store_return_requests')
    .select('*, store_return_request_items(id, store_order_item_id, product_id, quantity, price_at_time, products(name, image))')
    .in('store_order_id', orderIds)
    .order('created_at', { ascending: false });

  if (error) {
    if (/store_return_requests|schema cache|relation|does not exist/i.test(error.message || '')) {
      return new Map<string, Record<string, unknown>[]>();
    }
    throw error;
  }

  return (data || []).reduce((map, request) => {
    const key = String((request as Record<string, unknown>).store_order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(request as Record<string, unknown>);
    return map;
  }, new Map<string, Record<string, unknown>[]>());
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const tokenPayload = await verifyCustomerSessionToken(body?.sessionToken);
    if (!tokenPayload?.sub) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = getServiceClient();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', tokenPayload.sub)
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customer) return jsonResponse({ error: 'unauthorized' }, 401);

    const orderId = String(body?.orderId || '').trim();
    const selectFields = `
      *,
      store_order_items(id, product_id, quantity, price_at_time, products(name, image))
    `;

    const phoneValues = phoneVariants(customer.phone);
    const orderQueries = [];

    let customerIdQuery = supabase
      .from('store_orders')
      .select(selectFields)
      .eq('customer_id', customer.id);

    if (orderId) {
      customerIdQuery = customerIdQuery.or(`id.eq.${orderId},short_id.eq.${orderId.slice(0, 6)}`);
    }

    orderQueries.push(customerIdQuery);

    if (phoneValues.length > 0) {
      let phoneQuery = supabase
        .from('store_orders')
        .select(selectFields)
        .in('phone', phoneValues);

      if (orderId) {
        phoneQuery = phoneQuery.or(`id.eq.${orderId},short_id.eq.${orderId.slice(0, 6)}`);
      }

      orderQueries.push(phoneQuery);
    }

    const results = await Promise.all(orderQueries);
    for (const result of results) {
      if (result.error && !/customer_id|schema cache|column/i.test(result.error.message || '')) {
        throw result.error;
      }
    }

    const orders = mergeOrders(
      ...(results
        .filter((result) => !result.error)
        .map((result) => (result.data || []) as Record<string, unknown>[])),
    );

    const returnRequestsByOrder = await fetchReturnRequestsMap(
      supabase,
      orders.map((order) => String(order.id)).filter(Boolean),
    );

    const normalizedOrders = orders.map((order) => normalizeOrder({
      ...order,
      store_return_requests: returnRequestsByOrder.get(String(order.id)) || [],
    }));

    return jsonResponse({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      orders: normalizedOrders,
      order: orderId ? normalizedOrders[0] || null : null,
    });
  } catch (error) {
    console.error('customer-orders error:', error);
    return jsonResponse({ error: 'customer_orders_failed' }, 500);
  }
});

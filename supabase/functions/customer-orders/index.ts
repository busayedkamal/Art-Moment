import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { phoneVariants } from '../_shared/phone.ts';
import { fetchRewardPointsSummary } from '../_shared/rewardPoints.ts';
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
    selectedOptions: item.selected_options && typeof item.selected_options === 'object'
      ? item.selected_options
      : {},
    productOptions: Array.isArray((product as Record<string, unknown> | undefined)?.product_options)
      ? (product as Record<string, unknown>).product_options
      : [],
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
    subtotalAmount: Number(order.subtotal_amount ?? order.total_amount ?? 0),
    discountAmount: Number(order.discount_amount || 0),
    couponCode: order.coupon_code || null,
    totalAmount: Number(order.total_amount || 0),
    amountPaid: Number(order.amount_paid || 0),
    rewardPointsUsed: Number(order.reward_points_used || 0),
    pointsUsedAmount: Number(order.points_used_amount || 0),
    rewardPointsRestored: Number(order.reward_points_restored || 0),
    pointsRestoredAmount: Number(order.points_restored_amount || 0),
    rewardPointsEarned: Number(order.reward_points_earned || 0),
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

async function getReturnWindowDays(supabase: ReturnType<typeof getServiceClient>) {
  const { data, error } = await supabase
    .from('settings')
    .select('return_window_days')
    .eq('id', 1)
    .maybeSingle();
  if (error && !/return_window_days|schema cache|column|does not exist/i.test(error.message || '')) {
    throw error;
  }
  const parsed = Number(data?.return_window_days ?? 7);
  return Number.isFinite(parsed) ? Math.min(365, Math.max(1, Math.round(parsed))) : 7;
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

    const action = String(body?.action || 'get');
    if (action === 'apply_reward_points') {
      const requestedPoints = Math.max(0, Math.floor(Number(body?.points || 0)));
      if (!Number.isFinite(requestedPoints)) {
        return jsonResponse({ error: 'invalid_reward_points' }, 400);
      }
      const { data: redemption, error: redemptionError } = await supabase.rpc(
        'customer_apply_store_order_reward_points',
        {
          p_customer_id: customer.id,
          p_order_id: String(body?.orderId || ''),
          p_requested_points: requestedPoints,
        },
      );
      if (redemptionError) {
        return jsonResponse({ error: redemptionError.message || 'reward_redemption_failed' }, 409);
      }
      const rewards = await fetchRewardPointsSummary(supabase, customer.phone);
      return jsonResponse({ ok: true, redemption, rewards });
    }
    if (action !== 'get') return jsonResponse({ error: 'unknown_action' }, 400);

    const orderId = String(body?.orderId || '').trim();
    const selectFields = `
      *,
      store_order_items(id, product_id, quantity, price_at_time, selected_options, products(name, image, product_options))
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
    const returnWindowDays = await getReturnWindowDays(supabase);
    const rewards = await fetchRewardPointsSummary(supabase, customer.phone);
    const { data: friendshipCode, error: friendshipCodeError } = await supabase.rpc(
      'get_or_create_friendship_code',
      {
        p_phone: customer.phone,
        p_customer_name: customer.name,
      },
    );
    if (friendshipCodeError) {
      console.error('customer friendship code lookup failed:', friendshipCodeError);
    }

    return jsonResponse({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      orders: normalizedOrders,
      order: orderId ? normalizedOrders[0] || null : null,
      rewards,
      friendshipCode: friendshipCode || null,
      operationRules: { returnWindowDays },
    });
  } catch (error) {
    console.error('customer-orders error:', error);
    return jsonResponse({ error: 'customer_orders_failed' }, 500);
  }
});

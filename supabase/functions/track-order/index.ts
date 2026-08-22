import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { phoneVariants } from '../_shared/phone.ts';
import { fetchRewardPointsSummary } from '../_shared/rewardPoints.ts';
import { getServiceClient } from '../_shared/supabase.ts';

type RecordValue = Record<string, unknown>;

const PUBLIC_STATUS = {
  pending_payment: { label: 'بانتظار الدفع', description: 'بانتظار إكمال الدفع أو مراجعته.' },
  confirmed: { label: 'تم استلام الطلب', description: 'وصل الطلب إلى لحظة فن وتم تأكيده.' },
  processing: { label: 'قيد التجهيز', description: 'يجري تجهيز الطلب بعناية.' },
  ready: { label: 'جاهز', description: 'أصبح الطلب جاهزًا للتسليم أو الشحن.' },
  shipped: { label: 'تم الشحن', description: 'تم تسليم الطلب إلى شركة الشحن.' },
  completed: { label: 'مكتمل', description: 'تم تسليم الطلب بنجاح.' },
  cancelled: { label: 'ملغي', description: 'تم إلغاء الطلب.' },
  attention_required: { label: 'يحتاج متابعة', description: 'توجد خطوة تحتاج إلى تواصل أو مراجعة.' },
} as const;

const PUBLIC_STEPS = ['confirmed', 'processing', 'ready', 'shipped', 'completed'];

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function money(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function safeOptions(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as RecordValue).reduce((result, [key, item]) => {
    if (/url|uri|path|file|image|preview|original|storage|bucket|token/i.test(key)) return result;
    if (['string', 'number', 'boolean'].includes(typeof item) || item === null) {
      result[key] = item as string | number | boolean | null;
    }
    return result;
  }, {} as Record<string, string | number | boolean | null>);
}

function storePublicStatus(order: RecordValue) {
  const paymentStatus = cleanText(order.payment_status);
  const status = cleanText(order.status, 'pending_verification');
  if (paymentStatus === 'payment_failed') return 'attention_required';
  if (paymentStatus === 'pending_payment' && status === 'pending_verification') return 'pending_payment';
  const map: Record<string, keyof typeof PUBLIC_STATUS> = {
    pending_verification: 'confirmed',
    confirmed: 'confirmed',
    processing: 'processing',
    ready_for_delivery: 'ready',
    shipped: 'shipped',
    delivered: 'completed',
    cancelled: 'cancelled',
    returned: 'cancelled',
  };
  return map[status] || 'attention_required';
}

function printPublicStatus(order: RecordValue) {
  const status = cleanText(order.status, 'new');
  const map: Record<string, keyof typeof PUBLIC_STATUS> = {
    new: 'confirmed',
    printing: 'processing',
    done: 'ready',
    delivered: 'completed',
    cancelled: 'cancelled',
  };
  return map[status] || 'attention_required';
}

function buildTimeline(statusCode: keyof typeof PUBLIC_STATUS, history: RecordValue[] = []) {
  if (statusCode === 'cancelled' || statusCode === 'attention_required' || statusCode === 'pending_payment') {
    return [{
      code: statusCode,
      ...PUBLIC_STATUS[statusCode],
      occurredAt: history.at(-1)?.created_at || null,
      reason: history.at(-1)?.reason || null,
      current: true,
    }];
  }
  const currentIndex = Math.max(0, PUBLIC_STEPS.indexOf(statusCode));
  return PUBLIC_STEPS.slice(0, currentIndex + 1).map((code, index) => {
    const matching = history.find((entry) => storePublicStatus(entry) === code);
    return {
      code,
      ...PUBLIC_STATUS[code as keyof typeof PUBLIC_STATUS],
      occurredAt: matching?.created_at || null,
      reason: matching?.reason || null,
      current: index === currentIndex,
    };
  });
}

function normalizeStoreOrder(order: RecordValue, history: RecordValue[]) {
  const statusCode = storePublicStatus(order);
  const items = Array.isArray(order.store_order_items)
    ? order.store_order_items.map((item) => {
      const row = item as RecordValue;
      return {
        id: row.id,
        kind: cleanText(row.item_type, 'product'),
        name: cleanText(row.item_name, 'منتج من لحظة فن'),
        quantity: Number(row.quantity || 0),
        unitPrice: money(row.price_at_time),
        lineTotal: money(Number(row.quantity || 0) * Number(row.price_at_time || 0)),
        options: safeOptions(row.selected_options),
        status: statusCode,
      };
    })
    : [];

  return {
    orderType: 'store',
    orderNumber: cleanText(order.short_id) || String(order.id || '').slice(0, 6),
    status: { code: statusCode, ...PUBLIC_STATUS[statusCode] },
    timeline: buildTimeline(statusCode, history),
    createdAt: order.created_at,
    updatedAt: order.updated_at || null,
    items,
    financials: {
      subtotal: money(order.subtotal_amount ?? order.total_amount),
      discount: money(order.discount_amount),
      couponCode: cleanText(order.coupon_code) || null,
      productsTotal: money(order.total_amount),
      deliveryFee: money(order.delivery_fee),
      cashPaid: money(order.amount_paid),
      rewardPointsUsed: Number(order.reward_points_used || 0),
      pointsPaid: money(order.points_used_amount),
      refunded: money(order.refunded_amount),
      remaining: Math.max(0, money(
        Number(order.total_amount || 0)
        + Number(order.delivery_fee || 0)
        - Number(order.amount_paid || 0)
        - Number(order.points_used_amount || 0),
      )),
    },
    shipment: order.tracking_number
      ? {
          courier: cleanText(order.courier_name) || null,
          trackingNumber: cleanText(order.tracking_number),
        }
      : null,
  };
}

function normalizePrintOrder(order: RecordValue) {
  const statusCode = printPublicStatus(order);
  const dates: Record<string, unknown> = {
    confirmed: order.date_new || order.created_at,
    processing: order.date_printing,
    ready: order.date_done,
    completed: order.date_delivered,
  };
  const timeline = statusCode === 'cancelled' || statusCode === 'attention_required'
    ? [{ code: statusCode, ...PUBLIC_STATUS[statusCode], occurredAt: order.created_at, current: true }]
    : PUBLIC_STEPS
      .slice(0, Math.max(0, PUBLIC_STEPS.indexOf(statusCode)) + 1)
      .map((code) => ({
        code,
        ...PUBLIC_STATUS[code as keyof typeof PUBLIC_STATUS],
        occurredAt: dates[code] || null,
        current: code === statusCode,
      }));

  const items = [
    Number(order.photo_4x6_qty || 0) > 0
      ? { kind: 'print', name: 'طباعة صور 4×6', quantity: Number(order.photo_4x6_qty), status: statusCode }
      : null,
    Number(order.a4_qty || 0) > 0
      ? { kind: 'print', name: 'طباعة صور A4', quantity: Number(order.a4_qty), status: statusCode }
      : null,
  ].filter(Boolean);

  const total = money(order.total_amount);
  const cashPaid = money(order.deposit);
  const pointsPaid = money(order.points_used_amount ?? order.wallet_used);

  return {
    orderType: 'print',
    orderNumber: cleanText(order.short_id) || String(order.id || '').slice(0, 6),
    status: { code: statusCode, ...PUBLIC_STATUS[statusCode] },
    timeline,
    createdAt: order.created_at,
    updatedAt: order.date_delivered || order.date_done || order.date_printing || order.date_new || order.created_at || null,
    items,
    financials: {
      subtotal: money(order.subtotal),
      discount: money(
        Number(order.direct_discount_amount || 0)
        + Number(order.coupon_discount_amount || 0)
        + Number(order.package_discount_amount || 0),
      ),
      couponCode: cleanText(order.coupon_code) || null,
      productsTotal: total,
      deliveryFee: money(order.delivery_fee),
      cashPaid,
      pointsPaid,
      refunded: 0,
      remaining: Math.max(0, money(total - cashPaid - pointsPaid)),
    },
    shipment: null,
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getClientIp(req: Request) {
  return cleanText(req.headers.get('x-forwarded-for')).split(',')[0]?.trim()
    || cleanText(req.headers.get('x-real-ip'))
    || 'unknown';
}

function uniqueRows(rows: RecordValue[]) {
  const byId = new Map<string, RecordValue>();
  rows.forEach((row) => {
    if (row?.id) byId.set(String(row.id), row);
  });
  return [...byId.values()];
}

async function getSecureCustomerHistory(
  supabase: ReturnType<typeof getServiceClient>,
  sessionToken: unknown,
) {
  const tokenPayload = await verifyCustomerSessionToken(sessionToken);
  if (!tokenPayload?.sub) return null;

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('id', tokenPayload.sub)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return null;

  const phones = phoneVariants(customer.phone);
  const printFields = 'id, short_id, status, created_at, date_new, date_printing, date_done, date_delivered, photo_4x6_qty, a4_qty, subtotal, delivery_fee, total_amount, deposit, wallet_used, direct_discount_amount, coupon_discount_amount, coupon_code, package_discount_amount, points_used_amount';
  const storeFields = 'id, short_id, status, payment_status, payment_method, subtotal_amount, discount_amount, coupon_code, total_amount, delivery_fee, amount_paid, reward_points_used, points_used_amount, refunded_amount, tracking_number, courier_name, created_at, updated_at, store_order_items(id, item_type, item_name, quantity, price_at_time, selected_options)';

  const printPromise = phones.length > 0
    ? supabase.from('orders').select(printFields).in('phone', phones)
    : Promise.resolve({ data: [], error: null });
  const storeByCustomerPromise = supabase
    .from('store_orders')
    .select(storeFields)
    .eq('customer_id', customer.id);
  const storeByPhonePromise = phones.length > 0
    ? supabase.from('store_orders').select(storeFields).in('phone', phones)
    : Promise.resolve({ data: [], error: null });

  const [printResult, storeByCustomer, storeByPhone] = await Promise.all([
    printPromise,
    storeByCustomerPromise,
    storeByPhonePromise,
  ]);
  if (printResult.error) throw printResult.error;
  if (storeByCustomer.error && !/customer_id|schema cache|column/i.test(storeByCustomer.error.message || '')) {
    throw storeByCustomer.error;
  }
  if (storeByPhone.error) throw storeByPhone.error;

  const storeRows = uniqueRows([
    ...((storeByCustomer.data || []) as RecordValue[]),
    ...((storeByPhone.data || []) as RecordValue[]),
  ]);
  const storeIds = storeRows.map((row) => String(row.id)).filter(Boolean);
  const historyByOrder = new Map<string, RecordValue[]>();

  if (storeIds.length > 0) {
    const { data: statusRows, error: statusError } = await supabase
      .from('store_order_status_history')
      .select('store_order_id, status, reason, created_at')
      .in('store_order_id', storeIds)
      .order('created_at', { ascending: true });
    if (statusError) throw statusError;
    (statusRows || []).forEach((row) => {
      const key = String(row.store_order_id);
      if (!historyByOrder.has(key)) historyByOrder.set(key, []);
      historyByOrder.get(key)?.push(row as RecordValue);
    });
  }

  const orders = [
    ...storeRows.map((row) => ({
      ...normalizeStoreOrder(row, historyByOrder.get(String(row.id)) || []),
      id: row.id,
    })),
    ...((printResult.data || []) as RecordValue[]).map((row) => ({
      ...normalizePrintOrder(row),
      id: row.id,
    })),
  ].sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
  const rewards = await fetchRewardPointsSummary(supabase, customer.phone);
  const { data: friendshipCode, error: friendshipCodeError } = await supabase.rpc(
    'get_or_create_friendship_code',
    {
      p_phone: customer.phone,
      p_customer_name: customer.name,
    },
  );
  if (friendshipCodeError) {
    console.error('track-order friendship code lookup failed:', friendshipCodeError);
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      subscriptionCode: friendshipCode || null,
    },
    orders,
    rewards,
  };
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();

  try {
    const body = await req.json();
    if (String(body?.mode || '') === 'history') {
      const history = await getSecureCustomerHistory(supabase, body?.sessionToken);
      if (!history) return jsonResponse({ error: 'unauthorized' }, 401);
      return jsonResponse(history);
    }

    const orderNumber = cleanText(body?.orderNumber || body?.searchId)
      .replace('#', '')
      .toLowerCase()
      .slice(0, 12);
    const trackingToken = cleanText(body?.trackingToken || body?.token).toLowerCase();
    const ipHash = await sha256(getClientIp(req));
    const orderKeyHash = await sha256(orderNumber || 'missing');
    const since = new Date(Date.now() - (15 * 60 * 1000)).toISOString();

    const { count: failedAttempts, error: rateError } = await supabase
      .from('public_tracking_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('succeeded', false)
      .gte('created_at', since);
    if (rateError) throw rateError;
    if (Number(failedAttempts || 0) >= 10) {
      return jsonResponse({ error: 'tracking_unavailable' }, 429);
    }

    if (!orderNumber || trackingToken.length < 24) {
      await supabase.from('public_tracking_attempts').insert({
        ip_hash: ipHash,
        order_key_hash: orderKeyHash,
        succeeded: false,
      });
      return jsonResponse({ error: 'tracking_not_found' }, 404);
    }

    const [printResult, storeResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, short_id, status, created_at, date_new, date_printing, date_done, date_delivered, photo_4x6_qty, a4_qty, subtotal, delivery_fee, total_amount, deposit, wallet_used, direct_discount_amount, coupon_discount_amount, coupon_code, package_discount_amount, points_used_amount')
        .eq('short_id', orderNumber)
        .eq('tracking_access_token', trackingToken)
        .maybeSingle(),
      supabase
        .from('store_orders')
        .select('id, short_id, status, payment_status, payment_method, subtotal_amount, discount_amount, coupon_code, total_amount, delivery_fee, amount_paid, reward_points_used, points_used_amount, refunded_amount, tracking_number, courier_name, created_at, updated_at, store_order_items(id, item_type, item_name, quantity, price_at_time, selected_options)')
        .eq('short_id', orderNumber)
        .eq('tracking_access_token', trackingToken)
        .maybeSingle(),
    ]);

    if (printResult.error) throw printResult.error;
    if (storeResult.error) throw storeResult.error;

    const matched = storeResult.data || printResult.data;
    if (!matched) {
      await supabase.from('public_tracking_attempts').insert({
        ip_hash: ipHash,
        order_key_hash: orderKeyHash,
        succeeded: false,
      });
      return jsonResponse({ error: 'tracking_not_found' }, 404);
    }

    let order;
    if (storeResult.data) {
      const { data: history, error: historyError } = await supabase
        .from('store_order_status_history')
        .select('status, reason, created_at')
        .eq('store_order_id', storeResult.data.id)
        .order('created_at', { ascending: true });
      if (historyError) throw historyError;
      order = normalizeStoreOrder(storeResult.data as RecordValue, (history || []) as RecordValue[]);
    } else {
      order = normalizePrintOrder(printResult.data as RecordValue);
    }

    await supabase.from('public_tracking_attempts').insert({
      ip_hash: ipHash,
      order_key_hash: orderKeyHash,
      succeeded: true,
    });

    return jsonResponse({ order });
  } catch (error) {
    console.error('track-order error:', error);
    return jsonResponse({ error: 'tracking_failed' }, 500);
  }
});

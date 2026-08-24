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

  const photo4x6Quantity = Number(order.photo_4x6_qty || 0);
  const photo4x6UnitPrice = money(order.photo_4x6_unit_price);
  const a4Quantity = Number(order.a4_qty || 0);
  const a4UnitPrice = money(order.a4_unit_price);
  const items = [
    photo4x6Quantity > 0
      ? { kind: 'print', name: 'طباعة صور 4×6', quantity: photo4x6Quantity, unitPrice: photo4x6UnitPrice, lineTotal: money(photo4x6Quantity * photo4x6UnitPrice), status: statusCode }
      : null,
    a4Quantity > 0
      ? { kind: 'print', name: 'طباعة صور A4', quantity: a4Quantity, unitPrice: a4UnitPrice, lineTotal: money(a4Quantity * a4UnitPrice), status: statusCode }
      : null,
  ].filter(Boolean);

  const total = money(order.total_amount);
  const cashPaid = money(order.deposit);
  const pointsPaid = money(order.points_used_amount ?? order.wallet_used);
  const directDiscount = money(order.direct_discount_amount);
  const couponDiscount = money(order.coupon_discount_amount);
  const packageDiscount = money(order.package_discount_amount);
  const discounts = [
    directDiscount > 0 ? { type: 'direct', amount: directDiscount } : null,
    couponDiscount > 0 ? { type: 'coupon', amount: couponDiscount, code: cleanText(order.coupon_code) || null } : null,
    packageDiscount > 0 ? { type: 'package', amount: packageDiscount } : null,
  ].filter(Boolean);

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
      discount: money(directDiscount + couponDiscount + packageDiscount),
      discounts,
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

const localFailedAttempts = new Map<string, number[]>();

function getClientIp(req: Request) {
  return cleanText(req.headers.get('x-forwarded-for')).split(',')[0]?.trim()
    || cleanText(req.headers.get('x-real-ip'))
    || 'unknown';
}

function getLocalFailedAttemptCount(ipHash: string) {
  const cutoff = Date.now() - (15 * 60 * 1000);
  const attempts = (localFailedAttempts.get(ipHash) || []).filter((timestamp) => timestamp >= cutoff);
  if (attempts.length > 0) localFailedAttempts.set(ipHash, attempts);
  else localFailedAttempts.delete(ipHash);
  return attempts.length;
}

function rememberLocalFailedAttempt(ipHash: string) {
  const attempts = localFailedAttempts.get(ipHash) || [];
  attempts.push(Date.now());
  localFailedAttempts.set(ipHash, attempts.slice(-10));
}

function uniqueRows(rows: RecordValue[]) {
  const byId = new Map<string, RecordValue>();
  rows.forEach((row) => {
    if (row?.id) byId.set(String(row.id), row);
  });
  return [...byId.values()];
}

function orderBelongsToCustomer(order: RecordValue, customer: RecordValue) {
  const orderCustomerId = cleanText(order.customer_id);
  const customerId = cleanText(customer.id);
  if (orderCustomerId && customerId && orderCustomerId === customerId) return true;

  const customerPhones = new Set(phoneVariants(customer.phone));
  return phoneVariants(order.phone).some((phone) => customerPhones.has(phone));
}

async function getSecureCustomerHistory(
  supabase: ReturnType<typeof getServiceClient>,
  sessionToken: unknown,
) {
  let tokenPayload = null;
  try {
    tokenPayload = await verifyCustomerSessionToken(sessionToken);
  } catch (error) {
    console.error('track-order customer token verification failed:', error);
  }
  if (!tokenPayload?.sub) return null;

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('id', tokenPayload.sub)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return null;

  const phones = phoneVariants(customer.phone);
  const printPromise = phones.length > 0
    ? supabase.from('orders').select('*').in('phone', phones)
    : Promise.resolve({ data: [], error: null });
  const storeByCustomerPromise = supabase
    .from('store_orders')
    .select('*')
    .eq('customer_id', customer.id);
  const storeByPhonePromise = phones.length > 0
    ? supabase.from('store_orders').select('*').in('phone', phones)
    : Promise.resolve({ data: [], error: null });

  const [printResult, storeByCustomer, storeByPhone] = await Promise.all([
    printPromise,
    storeByCustomerPromise,
    storeByPhonePromise,
  ]);
  if (printResult.error) console.error('track-order print history failed:', printResult.error);
  if (storeByCustomer.error) console.error('track-order store customer history failed:', storeByCustomer.error);
  if (storeByPhone.error) console.error('track-order store phone history failed:', storeByPhone.error);

  const storeRows = uniqueRows([
    ...((storeByCustomer.error ? [] : storeByCustomer.data || []) as RecordValue[]),
    ...((storeByPhone.error ? [] : storeByPhone.data || []) as RecordValue[]),
  ]);
  const storeIds = storeRows.map((row) => String(row.id)).filter(Boolean);
  const historyByOrder = new Map<string, RecordValue[]>();

  if (storeIds.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from('store_order_items')
      .select('*')
      .in('store_order_id', storeIds);
    if (itemError) {
      console.error('track-order store items history failed:', itemError);
    } else {
      const itemsByOrder = new Map<string, RecordValue[]>();
      (itemRows || []).forEach((row) => {
        const key = String(row.store_order_id);
        if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
        itemsByOrder.get(key)?.push(row as RecordValue);
      });
      storeRows.forEach((row) => {
        row.store_order_items = itemsByOrder.get(String(row.id)) || [];
      });
    }

    const { data: statusRows, error: statusError } = await supabase
      .from('store_order_status_history')
      .select('store_order_id, status, reason, created_at')
      .in('store_order_id', storeIds)
      .order('created_at', { ascending: true });
    if (statusError) {
      console.error('track-order status history failed:', statusError);
    } else {
      (statusRows || []).forEach((row) => {
        const key = String(row.store_order_id);
        if (!historyByOrder.has(key)) historyByOrder.set(key, []);
        historyByOrder.get(key)?.push(row as RecordValue);
      });
    }
  }

  const orders = [
    ...storeRows.map((row) => ({
      ...normalizeStoreOrder(row, historyByOrder.get(String(row.id)) || []),
      id: row.id,
    })),
    ...((printResult.error ? [] : printResult.data || []) as RecordValue[]).map((row) => ({
      ...normalizePrintOrder(row),
      id: row.id,
    })),
  ].sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
  let rewards = null;
  try {
    rewards = await fetchRewardPointsSummary(supabase, customer.phone);
  } catch (error) {
    console.error('track-order rewards history failed:', error);
  }
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

    const ipHash = await sha256(getClientIp(req));
    const orderKeyHash = await sha256(orderNumber || 'missing');
    const since = new Date(Date.now() - (15 * 60 * 1000)).toISOString();

    const { count: failedAttempts, error: rateError } = await supabase
      .from('public_tracking_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('succeeded', false)
      .gte('created_at', since);
    if (rateError) console.error('track-order persistent rate limit unavailable:', rateError);
    const recentFailures = rateError
      ? getLocalFailedAttemptCount(ipHash)
      : Number(failedAttempts || 0);
    if (recentFailures >= 10) {
      return jsonResponse({ error: 'tracking_unavailable' }, 429);
    }

    if (orderNumber.length < 5) {
      rememberLocalFailedAttempt(ipHash);
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
        .select('id, short_id, status, created_at')
        .eq('short_id', orderNumber)
        .maybeSingle(),
      supabase
        .from('store_orders')
        .select('id, short_id, status, created_at')
        .eq('short_id', orderNumber)
        .maybeSingle(),
    ]);

    if (printResult.error) console.error('track-order print lookup failed:', printResult.error);
    if (storeResult.error) console.error('track-order store lookup failed:', storeResult.error);
    if (printResult.error && storeResult.error) throw new Error('order_sources_unavailable');

    const isStoreOrder = !storeResult.error && Boolean(storeResult.data);
    const matched = (storeResult.error ? null : storeResult.data)
      || (printResult.error ? null : printResult.data);
    if (!matched) {
      rememberLocalFailedAttempt(ipHash);
      await supabase.from('public_tracking_attempts').insert({
        ip_hash: ipHash,
        order_key_hash: orderKeyHash,
        succeeded: false,
      });
      return jsonResponse({ error: 'tracking_not_found' }, 404);
    }

    let detailsAllowed = false;
    let detailRow: RecordValue | null = null;
    const optionalSessionToken = body?.sessionToken;

    if (optionalSessionToken) {
      let tokenPayload = null;
      try {
        tokenPayload = await verifyCustomerSessionToken(optionalSessionToken);
      } catch (error) {
        console.error('track-order optional session verification failed:', error);
      }

      if (tokenPayload?.sub) {
        const { data: sessionCustomer, error: sessionCustomerError } = await supabase
          .from('customers')
          .select('id, phone')
          .eq('id', tokenPayload.sub)
          .maybeSingle();
        if (sessionCustomerError) {
          console.error('track-order optional customer lookup failed:', sessionCustomerError);
        } else if (sessionCustomer) {
          const sourceTable = isStoreOrder ? 'store_orders' : 'orders';
          const { data: candidateDetail, error: detailError } = await supabase
            .from(sourceTable)
            .select('*')
            .eq('id', (matched as RecordValue).id)
            .maybeSingle();
          if (detailError) {
            console.error('track-order owned detail lookup failed:', detailError);
          } else if (candidateDetail && orderBelongsToCustomer(candidateDetail as RecordValue, sessionCustomer as RecordValue)) {
            detailRow = candidateDetail as RecordValue;
            detailsAllowed = true;
          }
        }
      }
    }

    if (!detailsAllowed && body?.phone) {
      const requestedPhones = new Set(phoneVariants(body.phone));
      if (requestedPhones.size > 0) {
        const sourceTable = isStoreOrder ? 'store_orders' : 'orders';
        const { data: candidateDetail, error: detailError } = await supabase
          .from(sourceTable)
          .select('*')
          .eq('id', (matched as RecordValue).id)
          .maybeSingle();
        if (detailError) {
          console.error('track-order phone detail lookup failed:', detailError);
        } else if (
          candidateDetail
          && phoneVariants((candidateDetail as RecordValue).phone).some((phone) => requestedPhones.has(phone))
        ) {
          detailRow = candidateDetail as RecordValue;
          detailsAllowed = true;
        }
      }
    }

    let order;
    if (isStoreOrder && storeResult.data) {
      const storeRow = detailRow || (storeResult.data as RecordValue);
      if (detailsAllowed) {
        const { data: items, error: itemsError } = await supabase
          .from('store_order_items')
          .select('*')
          .eq('store_order_id', storeRow.id);
        if (itemsError) console.error('track-order owned items lookup failed:', itemsError);
        else storeRow.store_order_items = items || [];
      }

      const { data: history, error: historyError } = await supabase
        .from('store_order_status_history')
        .select('status, reason, created_at')
        .eq('store_order_id', storeRow.id)
        .order('created_at', { ascending: true });
      if (historyError) console.error('track-order public status history failed:', historyError);
      order = normalizeStoreOrder(storeRow, (history || []) as RecordValue[]);
    } else {
      order = normalizePrintOrder(detailRow || (printResult.data as RecordValue));
    }

    localFailedAttempts.delete(ipHash);
    await supabase.from('public_tracking_attempts').insert({
      ip_hash: ipHash,
      order_key_hash: orderKeyHash,
      succeeded: true,
    });

    if (detailsAllowed) {
      return jsonResponse({ order, detailsProtected: false });
    }

    return jsonResponse({
      detailsProtected: true,
      order: {
        orderType: order.orderType,
        orderNumber: order.orderNumber,
        status: order.status,
        timeline: order.timeline,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error('track-order error:', error);
    return jsonResponse({ error: 'tracking_failed' }, 500);
  }
});

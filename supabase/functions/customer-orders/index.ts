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

function normalizeOrder(order: Record<string, unknown>) {
  const items = Array.isArray(order.store_order_items)
    ? order.store_order_items.map((item) => normalizeOrderItem(item as Record<string, unknown>))
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

    const normalizedOrders = orders.map(normalizeOrder);

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

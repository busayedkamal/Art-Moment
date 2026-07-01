import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function generatePin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(1000 + (values[0] % 9000));
}

function formatWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  if (digits.startsWith('966')) return digits;
  return `966${digits}`;
}

async function sendWhatsAppConfirmation(order: Record<string, unknown>, customerPin: string) {
  const enabled = Deno.env.get('WHATSAPP_ENABLED') === 'true';
  const instanceId = Deno.env.get('ULTRAMSG_INSTANCE_ID');
  const token = Deno.env.get('ULTRAMSG_TOKEN');

  if (!enabled || !instanceId || !token) return;

  const phone = formatWhatsAppPhone(String(order.phone));
  const customerName = String(order.customer_name || 'عميلنا العزيز');
  const orderNumber = String(order.short_id || order.id).slice(0, 6);
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const message =
    `مرحباً *${customerName}*\n\n` +
    `تم استلام طلبك من متجر لحظة فن بنجاح.\n` +
    `رقم الطلب: *#${orderNumber}*\n` +
    `الإجمالي: *${totalAmount} ريال*\n` +
    `رمز التتبع (PIN): *${customerPin}*\n\n` +
    `طلبك الآن بانتظار التأكيد. شكراً لاختيارك لحظة فن.`;

  await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, to: phone, body: message }),
  });
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const customer = body?.customer || {};
    const items = Array.isArray(body?.items) ? body.items : [];
    let phone = normalizeSaudiPhone(customer.phone);

    const normalizedItems = items
      .map((item: Record<string, unknown>) => ({
        product_id: Number(item.id),
        quantity: Math.max(1, Number(item.qty || item.quantity || 1)),
      }))
      .filter((item: { product_id: number; quantity: number }) => Number.isFinite(item.product_id) && item.quantity > 0);

    if (normalizedItems.length === 0) {
      return jsonResponse({ error: 'empty_cart' }, 400);
    }

    const supabase = getServiceClient();
    let verifiedCustomerId: string | null = null;
    let verifiedCustomerName = '';

    const tokenPayload = await verifyCustomerSessionToken(customer.sessionToken);
    if (tokenPayload?.sub) {
      const { data: tokenCustomer, error: tokenCustomerError } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('id', tokenPayload.sub)
        .maybeSingle();
      if (tokenCustomerError) throw tokenCustomerError;

      const accountPhone = normalizeSaudiPhone(tokenCustomer?.phone);
      if (tokenCustomer && isValidSaudiMobile(accountPhone)) {
        verifiedCustomerId = String(tokenCustomer.id);
        verifiedCustomerName = String(tokenCustomer.name || '').trim();
        phone = accountPhone;
      }
    }

    if (!isValidSaudiMobile(phone)) {
      return jsonResponse({ error: 'invalid_phone' }, 400);
    }

    const productIds = normalizedItems.map((item: { product_id: number }) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, in_stock, stock_quantity')
      .in('id', productIds);

    if (productsError) throw productsError;

    const productById = new Map((products || []).map((product: Record<string, unknown>) => [String(product.id), product]));
    let subtotal = 0;

    const orderItems = normalizedItems.map((item: { product_id: number; quantity: number }) => {
      const product = productById.get(String(item.product_id));
      if (!product || product.in_stock === false) throw new Error('product_unavailable');

      const stockQuantity = product.stock_quantity;
      if (stockQuantity !== null && stockQuantity !== undefined && Number(stockQuantity) < item.quantity) {
        throw new Error('product_out_of_stock');
      }

      const price = Number(product.price || 0);
      subtotal += price * item.quantity;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time: price,
      };
    });

    const variants = phoneVariants(phone);

    const { data: existingWallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, subscription_code')
      .in('phone', variants)
      .limit(1)
      .maybeSingle();

    if (walletError) throw walletError;

    let customerPin = existingWallet?.subscription_code;
    if (!existingWallet) {
      customerPin = generatePin();
      const { error: createWalletError } = await supabase
        .from('wallets')
        .insert({
          phone,
          subscription_code: customerPin,
          points_balance: 0,
          total_spent: 0,
        });
      if (createWalletError) throw createWalletError;
    }

    const orderPayload: Record<string, unknown> = {
      customer_name: String(customer.name || verifiedCustomerName || 'عميل المتجر').trim(),
      phone,
      total_amount: subtotal,
      amount_paid: 0,
      delivery_fee: 0,
      notes: String(customer.notes || '').trim() || null,
      city: String(customer.city || '').trim() || null,
      district: String(customer.district || '').trim() || null,
      street: String(customer.street || '').trim() || null,
    };
    if (verifiedCustomerId) orderPayload.customer_id = verifiedCustomerId;

    let orderInsert = await supabase
      .from('store_orders')
      .insert(orderPayload)
      .select('id, short_id, customer_name, phone, total_amount')
      .single();

    if (orderInsert.error && orderPayload.customer_id && /customer_id|schema cache|column/i.test(orderInsert.error.message || '')) {
      delete orderPayload.customer_id;
      orderInsert = await supabase
        .from('store_orders')
        .insert(orderPayload)
        .select('id, short_id, customer_name, phone, total_amount')
        .single();
    }

    if (orderInsert.error) throw orderInsert.error;
    const order = orderInsert.data;

    const { error: itemsError } = await supabase
      .from('store_order_items')
      .insert(orderItems.map((item: Record<string, unknown>) => ({
        ...item,
        store_order_id: order.id,
      })));

    if (itemsError) throw itemsError;

    try {
      await sendWhatsAppConfirmation(order, String(customerPin));
    } catch (notifyError) {
      console.error('store checkout notification error:', notifyError);
    }

    return jsonResponse({
      order: {
        id: order.id,
        short_id: order.short_id,
        total_amount: order.total_amount,
      },
      customer_pin: customerPin,
    });
  } catch (error) {
    console.error('store-checkout error:', error);
    const message = error instanceof Error ? error.message : 'checkout_failed';
    const status = ['product_unavailable', 'product_out_of_stock'].includes(message) ? 409 : 500;
    return jsonResponse({ error: message }, status);
  }
});

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { calculateStoreCouponDiscount } from '../_shared/storeCoupons.ts';
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

function orderEmailHtml(order: Record<string, unknown>, customerPin: string, coupon?: { discountValue?: unknown } | null) {
  const orderNumber = String(order.short_id || order.id).slice(0, 6);
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const discount = Number(coupon?.discountValue || 0);
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A;background:#F8F5F2;padding:28px">
      <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:24px;padding:28px">
        <p style="margin:0 0 8px;color:#C5A059;font-weight:700">لحظة فن Art Moment</p>
        <h2 style="margin:0 0 12px;color:#4A4A4A">تم استلام طلبك بنجاح</h2>
        <p style="margin:0 0 18px">شكراً لاختيارك لحظة فن. وصلنا طلبك وهو الآن بانتظار التأكيد والدفع.</p>
        <div style="background:#F8F5F2;border-radius:18px;padding:16px;margin:16px 0">
          <p style="margin:0">رقم الطلب: <strong>#${orderNumber}</strong></p>
          <p style="margin:6px 0 0">الإجمالي: <strong>${totalAmount} ريال</strong></p>
          ${discount > 0 ? `<p style="margin:6px 0 0;color:#059669">الخصم: <strong>${discount.toFixed(2)} ريال</strong></p>` : ''}
          <p style="margin:6px 0 0">رمز التتبع: <strong>${customerPin}</strong></p>
        </div>
        <p style="font-size:13px;color:#777;margin:0">يمكنك متابعة الطلب من صفحة طلباتي داخل المتجر.</p>
      </div>
    </div>
  `;
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
    const payment = body?.payment || {};
    const couponCode = body?.couponCode;
    const items = Array.isArray(body?.items) ? body.items : [];
    let phone = normalizeSaudiPhone(customer.phone);
    const allowedPaymentMethods = new Set(['bank_transfer', 'cash_on_delivery', 'card', 'wallet', 'manual', 'other']);
    const paymentMethod = allowedPaymentMethods.has(String(payment.method))
      ? String(payment.method)
      : 'bank_transfer';

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
    let verifiedCustomerEmail = '';

    const tokenPayload = await verifyCustomerSessionToken(customer.sessionToken);
    if (tokenPayload?.sub) {
      const { data: tokenCustomer, error: tokenCustomerError } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('id', tokenPayload.sub)
        .maybeSingle();
      if (tokenCustomerError) throw tokenCustomerError;

      const accountPhone = normalizeSaudiPhone(tokenCustomer?.phone);
      if (tokenCustomer && isValidSaudiMobile(accountPhone)) {
        verifiedCustomerId = String(tokenCustomer.id);
        verifiedCustomerName = String(tokenCustomer.name || '').trim();
        verifiedCustomerEmail = String(tokenCustomer.email || '').trim();
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

    const coupon = await calculateStoreCouponDiscount(supabase, couponCode, subtotal);
    const discountAmount = Number(coupon?.discountValue || 0);
    const finalTotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
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
      subtotal_amount: subtotal,
      discount_amount: discountAmount,
      coupon_code: coupon?.code || null,
      total_amount: finalTotal,
      amount_paid: 0,
      delivery_fee: 0,
      payment_status: 'pending_payment',
      payment_method: paymentMethod,
      payment_reference: null,
      payment_failed_reason: null,
      refunded_amount: 0,
      payment_updated_at: new Date().toISOString(),
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

    if (orderInsert.error && /customer_id|payment_status|payment_method|payment_reference|payment_failed_reason|refunded_amount|payment_updated_at|schema cache|column/i.test(orderInsert.error.message || '')) {
      if (/customer_id/i.test(orderInsert.error.message || '')) delete orderPayload.customer_id;
      if (/subtotal_amount|discount_amount|coupon_code|schema cache|column/i.test(orderInsert.error.message || '')) {
        delete orderPayload.subtotal_amount;
        delete orderPayload.discount_amount;
        delete orderPayload.coupon_code;
      }
      if (/payment_status|payment_method|payment_reference|payment_failed_reason|refunded_amount|payment_updated_at|schema cache|column/i.test(orderInsert.error.message || '')) {
        delete orderPayload.payment_status;
        delete orderPayload.payment_method;
        delete orderPayload.payment_reference;
        delete orderPayload.payment_failed_reason;
        delete orderPayload.refunded_amount;
        delete orderPayload.payment_updated_at;
      }
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

    if (verifiedCustomerEmail) {
      try {
        await sendEmail({
          to: verifiedCustomerEmail,
          subject: `تم استلام طلبك #${String(order.short_id || order.id).slice(0, 6)} - لحظة فن`,
          html: orderEmailHtml(order, String(customerPin), coupon),
          text: `تم استلام طلبك من لحظة فن. رقم الطلب: #${String(order.short_id || order.id).slice(0, 6)}. الإجمالي: ${Number(order.total_amount || 0).toFixed(2)} ريال. رمز التتبع: ${customerPin}.`,
          tags: [{ name: 'type', value: 'store_order_confirmation' }],
        });
      } catch (emailError) {
        console.error('store checkout customer email error:', emailError);
      }
    }

    const adminEmail = Deno.env.get('STORE_ORDER_NOTIFY_EMAIL') || Deno.env.get('RETURN_REQUEST_NOTIFY_EMAIL') || Deno.env.get('ADMIN_NOTIFY_EMAIL');
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `طلب متجر جديد #${String(order.short_id || order.id).slice(0, 6)}`,
          html: orderEmailHtml(order, String(customerPin), coupon),
          text: `طلب متجر جديد #${String(order.short_id || order.id).slice(0, 6)} بقيمة ${Number(order.total_amount || 0).toFixed(2)} ريال.`,
          tags: [{ name: 'type', value: 'store_order_admin_notification' }],
        });
      } catch (emailError) {
        console.error('store checkout admin email error:', emailError);
      }
    }

    return jsonResponse({
      order: {
        id: order.id,
        short_id: order.short_id,
        total_amount: order.total_amount,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        coupon_code: coupon?.code || null,
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

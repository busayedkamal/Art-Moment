import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function normalizeItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((rawItem) => {
      const item = rawItem && typeof rawItem === 'object'
        ? rawItem as Record<string, unknown>
        : {};
      return {
        productId: Number(item.id || item.productId),
        quantity: Math.max(1, Math.floor(Number(item.qty || item.quantity || 1))),
        selectedOptions: item.selectedOptions && typeof item.selectedOptions === 'object'
          ? item.selectedOptions
          : {},
      };
    })
    .filter((item) => Number.isFinite(item.productId) && item.quantity > 0)
    .slice(0, 50);
}

function resolveItemPrice(
  basePrice: number,
  rawOptions: unknown,
  rawSelections: unknown,
) {
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const selections = rawSelections && typeof rawSelections === 'object'
    ? rawSelections as Record<string, unknown>
    : {};
  let price = basePrice;

  for (const rawOption of options) {
    if (!rawOption || typeof rawOption !== 'object') continue;
    const option = rawOption as Record<string, unknown>;
    const optionId = String(option.id || '');
    const selectedValue = String(selections[optionId] || '');
    const values = Array.isArray(option.values) ? option.values : [];
    const matched = values.find((rawValue) => {
      if (typeof rawValue === 'string') return rawValue === selectedValue;
      if (!rawValue || typeof rawValue !== 'object') return false;
      const value = rawValue as Record<string, unknown>;
      return String(value.id || value.value || value.label || '') === selectedValue;
    });
    if (matched && typeof matched === 'object') {
      price += Number((matched as Record<string, unknown>).priceDelta || 0);
    }
  }

  return Math.max(0, Number(price.toFixed(2)));
}

async function requireCustomer(supabase: ReturnType<typeof getServiceClient>, sessionToken: unknown) {
  const tokenPayload = await verifyCustomerSessionToken(String(sessionToken || ''));
  if (!tokenPayload?.sub) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, marketing_opt_in')
    .eq('id', tokenPayload.sub)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function reminderHtml(customerName: string, items: Array<Record<string, unknown>>, subtotal: number, cartUrl: string) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0e3e4">${String(item.name || 'منتج')}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0e3e4;text-align:left">${Number(item.quantity || 0)}</td>
    </tr>
  `).join('');

  return `
    <div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;background:#F8F5F2;padding:28px;color:#4A4A4A">
      <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:20px;padding:26px">
        <p style="color:#C5A059;font-weight:800;margin:0 0 8px">لحظة فن Art Moment</p>
        <h2 style="margin:0 0 12px">منتجاتك ما زالت بانتظارك</h2>
        <p>مرحباً ${customerName || 'عميلنا العزيز'}، حفظنا المنتجات التي اخترتها لتكمل طلبك وقتما يناسبك.</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0">${rows}</table>
        <p style="font-weight:800">قيمة السلة التقريبية: ${subtotal.toFixed(2)} ر.س</p>
        <a href="${cartUrl}" style="display:inline-block;background:#4A4A4A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:800">
          استعادة السلة
        </a>
        <p style="font-size:12px;color:#888;margin-top:18px">وصلتك الرسالة لأنك وافقت على استقبال تحديثات لحظة فن، ويمكنك إلغاء الاشتراك من حسابك.</p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();
  try {
    const body = await req.json();
    const action = String(body?.action || 'sync');

    if (action === 'send_due') {
      const cronSecret = Deno.env.get('ABANDONED_CART_CRON_SECRET');
      if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
        return jsonResponse({ error: 'not_authorized' }, 403);
      }

      const cutoff = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
      const { data: dueCarts, error: dueError } = await supabase
        .from('abandoned_carts')
        .select('id, customer_id, items, subtotal, customers(name, email, marketing_opt_in)')
        .eq('status', 'active')
        .is('reminder_sent_at', null)
        .lte('last_activity_at', cutoff)
        .gt('expires_at', new Date().toISOString())
        .limit(100);
      if (dueError) throw dueError;

      let sent = 0;
      for (const cart of dueCarts || []) {
        const customer = Array.isArray(cart.customers) ? cart.customers[0] : cart.customers;
        if (!customer?.marketing_opt_in || !customer?.email) continue;
        const cartUrl = `${Deno.env.get('PUBLIC_SITE_URL') || 'https://art-moment.com'}/store/cart`;
        try {
          await sendEmail({
            to: customer.email,
            subject: 'منتجاتك في لحظة فن ما زالت بانتظارك',
            html: reminderHtml(customer.name || '', Array.isArray(cart.items) ? cart.items : [], Number(cart.subtotal || 0), cartUrl),
            text: `منتجاتك في لحظة فن ما زالت بانتظارك. استعد سلتك: ${cartUrl}`,
            tags: [{ name: 'type', value: 'abandoned_cart' }],
          });
          await supabase.from('abandoned_carts').update({ reminder_sent_at: new Date().toISOString() }).eq('id', cart.id);
          sent += 1;
        } catch (emailError) {
          console.error('abandoned cart email failed:', emailError);
        }
      }
      return jsonResponse({ ok: true, sent });
    }

    const customer = await requireCustomer(supabase, body?.sessionToken);
    if (!customer) return jsonResponse({ error: 'unauthorized' }, 401);

    if (action === 'get') {
      if (!customer.marketing_opt_in) return jsonResponse({ cart: null, marketingEligible: false });
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('id, items, subtotal, last_activity_at')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ cart: data || null, marketingEligible: true });
    }

    if (action === 'complete') {
      await supabase
        .from('abandoned_carts')
        .update({
          status: 'converted',
          converted_order_id: body?.orderId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customer.id)
        .eq('status', 'active');
      return jsonResponse({ ok: true });
    }

    if (action !== 'sync') return jsonResponse({ error: 'unknown_action' }, 400);
    if (!customer.marketing_opt_in || !customer.email) {
      return jsonResponse({ ok: true, saved: false, reason: 'marketing_opt_in_required' });
    }

    const normalizedItems = normalizeItems(body?.items);
    if (normalizedItems.length === 0) {
      await supabase
        .from('abandoned_carts')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('customer_id', customer.id)
        .eq('status', 'active');
      return jsonResponse({ ok: true, saved: false });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, price, image, in_stock, stock_quantity, product_options')
      .in('id', productIds);
    if (productError) throw productError;
    const productById = new Map((products || []).map((product) => [Number(product.id), product]));

    const items = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) return null;
      const price = resolveItemPrice(
        Number(product.price || 0),
        product.product_options,
        item.selectedOptions,
      );
      return {
        id: product.id,
        name: product.name,
        image: product.image,
        price,
        qty: item.quantity,
        selectedOptions: item.selectedOptions,
        productOptions: product.product_options || [],
        stockQuantity: product.stock_quantity,
        inStock: product.in_stock !== false,
      };
    }).filter(Boolean);
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);

    const { data: existing } = await supabase
      .from('abandoned_carts')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();
    const payload = {
      customer_id: customer.id,
      anonymous_id: String(body?.anonymousId || '').slice(0, 100) || null,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = existing?.id
      ? await supabase.from('abandoned_carts').update(payload).eq('id', existing.id)
      : await supabase.from('abandoned_carts').insert(payload);
    if (result.error) throw result.error;
    return jsonResponse({ ok: true, saved: true });
  } catch (error) {
    console.error('abandoned-cart error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'abandoned_cart_failed' }, 500);
  }
});

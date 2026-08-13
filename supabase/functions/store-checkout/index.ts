import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { calculateStoreCouponDiscount } from '../_shared/storeCoupons.ts';
import { recalculatePrintDraft, verifyPrintDraftAccess } from '../_shared/printDrafts.ts';
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

function getStockRpcErrorMessage(error: { message?: string } | null) {
  const message = String(error?.message || '');
  if (/product_out_of_stock/i.test(message)) return 'product_out_of_stock';
  if (/product_unavailable/i.test(message)) return 'product_unavailable';
  if (/invalid_stock_items/i.test(message)) return 'invalid_stock_items';
  if (/not_authorized/i.test(message)) return 'not_authorized';
  return 'stock_reservation_failed';
}

function normalizeProductOptions(rawOptions: unknown) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.map((rawOption, optionIndex) => {
    const option = rawOption && typeof rawOption === 'object'
      ? rawOption as Record<string, unknown>
      : {};
    const id = String(option.id || `option_${optionIndex + 1}`).trim();
    const values = Array.isArray(option.values)
      ? option.values.map((rawValue) => {
        const valueObject = rawValue && typeof rawValue === 'object'
          ? rawValue as Record<string, unknown>
          : { value: rawValue, label: rawValue };
        const value = String(valueObject.value || valueObject.label || '').trim();
        return {
          value,
          priceDelta: Number(valueObject.priceDelta || valueObject.price_delta || 0),
        };
      }).filter((value) => value.value)
      : [];
    return {
      id,
      required: option.required !== false,
      values,
    };
  }).filter((option) => option.id && option.values.length > 0);
}

function resolveProductOptions(
  rawOptions: unknown,
  rawSelections: unknown,
) {
  const productOptions = normalizeProductOptions(rawOptions);
  const selections = rawSelections && typeof rawSelections === 'object' && !Array.isArray(rawSelections)
    ? rawSelections as Record<string, unknown>
    : {};
  const normalizedSelections: Record<string, string> = {};
  let priceDelta = 0;

  for (const option of productOptions) {
    const selectedValue = String(selections[option.id] || '').trim();
    const matchedValue = option.values.find((value) => value.value === selectedValue);
    if (option.required && !matchedValue) throw new Error('invalid_product_options');
    if (matchedValue) {
      normalizedSelections[option.id] = matchedValue.value;
      priceDelta += Number(matchedValue.priceDelta || 0);
    }
  }

  return {
    selections: normalizedSelections,
    priceDelta,
  };
}

async function sendWhatsAppConfirmation(
  order: Record<string, unknown>,
  customerPin: string,
  rewards?: { points?: number; value?: number },
) {
  const enabled = Deno.env.get('WHATSAPP_ENABLED') === 'true';
  const instanceId = Deno.env.get('ULTRAMSG_INSTANCE_ID');
  const token = Deno.env.get('ULTRAMSG_TOKEN');

  if (!enabled || !instanceId || !token) return;

  const phone = formatWhatsAppPhone(String(order.phone));
  const customerName = String(order.customer_name || 'عميلنا العزيز');
  const orderNumber = String(order.short_id || order.id).slice(0, 6);
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const rewardLine = Number(rewards?.points || 0) > 0
    ? `النقاط المستخدمة: *${Number(rewards?.points || 0)} نقطة* (${Number(rewards?.value || 0).toFixed(2)} ريال)\n`
    : '';
  const message =
    `مرحباً *${customerName}*\n\n` +
    `تم استلام طلبك من متجر لحظة فن بنجاح.\n` +
    `رقم الطلب: *#${orderNumber}*\n` +
    `الإجمالي: *${totalAmount} ريال*\n` +
    rewardLine +
    `المتبقي للدفع: *${Math.max(0, Number(totalAmount) - Number(rewards?.value || 0)).toFixed(2)} ريال*\n` +
    `رمز التتبع (PIN): *${customerPin}*\n\n` +
    `طلبك الآن بانتظار التأكيد. شكراً لاختيارك لحظة فن.`;

  await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, to: phone, body: message }),
  });
}

function orderEmailHtml(
  order: Record<string, unknown>,
  customerPin: string,
  coupon?: { discountValue?: unknown } | null,
  rewards?: { points?: number; value?: number },
) {
  const orderNumber = String(order.short_id || order.id).slice(0, 6);
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const discount = Number(coupon?.discountValue || 0);
  const rewardPoints = Number(rewards?.points || 0);
  const rewardValue = Number(rewards?.value || 0);
  const amountDue = Math.max(0, Number(totalAmount) - rewardValue);
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
          ${rewardPoints > 0 ? `<p style="margin:6px 0 0;color:#B97882">مدفوع بالنقاط: <strong>${rewardPoints} نقطة (${rewardValue.toFixed(2)} ريال)</strong></p>` : ''}
          <p style="margin:6px 0 0">المتبقي للدفع: <strong>${amountDue.toFixed(2)} ريال</strong></p>
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

  const supabase = getServiceClient();
  let createdOrderId: string | null = null;
  let stockReserved = false;
  let reservedStockItems: Array<{ product_id: number; quantity: number }> = [];
  let redeemedRewardPoints = false;
  let rewardWalletId: number | null = null;
  let rewardOrderValue = 0;
  let orderedPrintDraftIds: string[] = [];

  try {
    const body = await req.json();
    const customer = body?.customer || {};
    const payment = body?.payment || {};
    const couponCode = body?.couponCode;
    const requestedRewardPoints = Math.max(0, Math.floor(Number(body?.rewardPoints || 0)));
    const items = Array.isArray(body?.items) ? body.items : [];
    let phone = normalizeSaudiPhone(customer.phone);
    const allowedPaymentMethods = new Set(['bank_transfer', 'cash_on_delivery', 'card', 'wallet', 'manual', 'other']);
    const paymentMethod = allowedPaymentMethods.has(String(payment.method))
      ? String(payment.method)
      : 'bank_transfer';

    const normalizedItems = items
      .filter((item: Record<string, unknown>) => item.itemType !== 'print')
      .map((item: Record<string, unknown>) => ({
        product_id: Number(item.id),
        quantity: Math.max(1, Number(item.qty || item.quantity || 1)),
        selected_options: item.selectedOptions && typeof item.selectedOptions === 'object'
          ? item.selectedOptions
          : {},
      }))
      .filter((item: { product_id: number; quantity: number }) => Number.isFinite(item.product_id) && item.quantity > 0);

    const printItems = items
      .filter((item: Record<string, unknown>) => item.itemType === 'print')
      .map((item: Record<string, unknown>) => ({
        draft_id: String(item.printDraftId || ''),
        access_token: String(item.printDraftToken || ''),
      }))
      .filter((item: { draft_id: string; access_token: string }) => item.draft_id && item.access_token);

    if (normalizedItems.length === 0 && printItems.length === 0) {
      return jsonResponse({ error: 'empty_cart' }, 400);
    }

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
    let products: Array<Record<string, unknown>> = [];
    if (productIds.length > 0) {
      const productResult = await supabase
        .from('products')
        .select('id, name, price, in_stock, stock_quantity, product_options')
        .in('id', productIds);
      if (productResult.error) throw productResult.error;
      products = productResult.data || [];
    }

    const productById = new Map((products || []).map((product: Record<string, unknown>) => [String(product.id), product]));
    let subtotal = 0;

    const orderItems: Array<Record<string, unknown>> = normalizedItems.map((item: {
      product_id: number;
      quantity: number;
      selected_options: Record<string, unknown>;
    }) => {
      const product = productById.get(String(item.product_id));
      if (!product || product.in_stock === false) throw new Error('product_unavailable');

      const stockQuantity = product.stock_quantity;
      if (stockQuantity !== null && stockQuantity !== undefined && Number(stockQuantity) < item.quantity) {
        throw new Error('product_out_of_stock');
      }

      const resolvedOptions = resolveProductOptions(product.product_options, item.selected_options);
      const price = Number((Number(product.price || 0) + resolvedOptions.priceDelta).toFixed(2));
      subtotal += price * item.quantity;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time: price,
        selected_options: resolvedOptions.selections,
      };
    });

    const printDraftsForOrder: Array<Record<string, unknown>> = [];
    for (const printItem of printItems) {
      const accessedDraft = await verifyPrintDraftAccess(supabase, printItem.draft_id, printItem.access_token);
      let readyDraft = accessedDraft;
      if (!readyDraft.snapshot_at) {
        const recalculated = await recalculatePrintDraft(supabase, accessedDraft.id);
        const { data: snapshottedDraft, error: snapshotError } = await supabase
          .from('print_drafts')
          .update({
            snapshot_unit_price: recalculated.draft.unit_price,
            snapshot_subtotal: recalculated.draft.subtotal,
            snapshot_total_copies: recalculated.draft.total_copies,
            snapshot_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', accessedDraft.id)
          .eq('status', 'ready')
          .select('*')
          .single();
        if (snapshotError) throw snapshotError;
        readyDraft = snapshottedDraft;
      }
      if (readyDraft.status !== 'ready' || Number(readyDraft.file_count || 0) < 1) {
        throw new Error('print_draft_not_ready');
      }
      const snapshotUnitPrice = Number(readyDraft.snapshot_unit_price ?? readyDraft.unit_price ?? 0);
      const snapshotSubtotal = Number(readyDraft.snapshot_subtotal ?? readyDraft.subtotal ?? 0);
      const snapshotTotalCopies = Number(readyDraft.snapshot_total_copies ?? readyDraft.total_copies ?? 0);
      if (snapshotUnitPrice <= 0 || snapshotSubtotal <= 0 || snapshotTotalCopies < 1) {
        throw new Error('print_snapshot_invalid');
      }
      subtotal += snapshotSubtotal;
      printDraftsForOrder.push(readyDraft);
      orderItems.push({
        product_id: null,
        item_type: 'print',
        item_name: `طباعة صور ${readyDraft.print_size}`,
        print_draft_id: readyDraft.id,
        quantity: snapshotTotalCopies,
        price_at_time: snapshotUnitPrice,
        selected_options: {
          print_size: readyDraft.print_size,
          material: readyDraft.material,
          surface: readyDraft.surface,
          border_style: readyDraft.border_style,
          fit_mode: readyDraft.fit_mode,
        },
        metadata: {
          file_count: Number(readyDraft.file_count || 0),
          total_copies: snapshotTotalCopies,
          unit_price: snapshotUnitPrice,
          total_price: snapshotSubtotal,
          snapshot_at: readyDraft.snapshot_at,
          variant_id: readyDraft.variant_id,
          original_files_private: true,
        },
      });
    }

    const coupon = await calculateStoreCouponDiscount(supabase, couponCode, subtotal);
    const discountAmount = Number(coupon?.discountValue || 0);
    const finalTotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
    rewardOrderValue = finalTotal;
    const variants = phoneVariants(phone);

    const { data: matchingWallets, error: walletError } = await supabase
      .from('wallets')
      .select('id, subscription_code, reward_points_balance, points_balance')
      .in('phone', variants);

    if (walletError) throw walletError;

    const existingWallet = (matchingWallets || []).sort((left, right) => {
      const leftPoints = Number(left.reward_points_balance ?? Math.round(Number(left.points_balance || 0) / 0.01));
      const rightPoints = Number(right.reward_points_balance ?? Math.round(Number(right.points_balance || 0) / 0.01));
      return rightPoints - leftPoints || Number(right.id || 0) - Number(left.id || 0);
    })[0];

    let customerPin = existingWallet?.subscription_code;
    let activeWallet = existingWallet;
    if (!existingWallet) {
      customerPin = generatePin();
      const { data: createdWallet, error: createWalletError } = await supabase
        .from('wallets')
        .insert({
          phone,
          subscription_code: customerPin,
          points_balance: 0,
          reward_points_balance: 0,
          total_spent: 0,
        })
        .select('id, subscription_code, reward_points_balance, points_balance')
        .single();
      if (createWalletError) throw createWalletError;
      activeWallet = createdWallet;
    }

    const { data: rewardSettings, error: rewardSettingsError } = await supabase
      .from('settings')
      .select('reward_program_enabled, reward_point_value, reward_minimum_redemption_points, reward_maximum_redemption_percent')
      .eq('id', 1)
      .maybeSingle();
    if (rewardSettingsError) throw rewardSettingsError;

    const pointValue = Number(rewardSettings?.reward_point_value || 0.01);
    const minimumRedemptionPoints = Number(rewardSettings?.reward_minimum_redemption_points || 500);
    const maximumRedemptionPercent = Number(rewardSettings?.reward_maximum_redemption_percent || 25);
    const availableRewardPoints = Number(activeWallet?.reward_points_balance
      ?? Math.round(Number(activeWallet?.points_balance || 0) / pointValue));
    const maximumRewardPoints = Math.max(0, Math.min(
      availableRewardPoints,
      Math.floor((finalTotal * maximumRedemptionPercent / 100) / pointValue),
    ));

    if (requestedRewardPoints > 0) {
      if (!verifiedCustomerId) return jsonResponse({ error: 'reward_login_required' }, 401);
      if (rewardSettings?.reward_program_enabled === false) {
        return jsonResponse({ error: 'reward_program_disabled' }, 409);
      }
      if (requestedRewardPoints < minimumRedemptionPoints) {
        return jsonResponse({ error: 'reward_minimum_redemption_not_met' }, 409);
      }
      if (requestedRewardPoints > availableRewardPoints) {
        return jsonResponse({ error: 'reward_points_balance_insufficient' }, 409);
      }
      if (requestedRewardPoints > maximumRewardPoints) {
        return jsonResponse({ error: 'reward_redemption_limit_exceeded' }, 409);
      }
    }

    const pointsUsedAmount = Number((requestedRewardPoints * pointValue).toFixed(2));
    rewardWalletId = Number(activeWallet?.id || 0) || null;

    const orderPayload: Record<string, unknown> = {
      customer_name: String(customer.name || verifiedCustomerName || 'عميل المتجر').trim(),
      phone,
      subtotal_amount: subtotal,
      discount_amount: discountAmount,
      coupon_code: coupon?.code || null,
      total_amount: finalTotal,
      amount_paid: 0,
      reward_points_used: requestedRewardPoints,
      points_used_amount: pointsUsedAmount,
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

    reservedStockItems = normalizedItems.map((item: { product_id: number; quantity: number }) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    if (reservedStockItems.length > 0) {
      const { error: reserveStockError } = await supabase.rpc('reserve_store_stock', {
        items: reservedStockItems,
      });
      if (reserveStockError) throw new Error(getStockRpcErrorMessage(reserveStockError));
      stockReserved = true;
    }

    let orderInsert = await supabase
      .from('store_orders')
      .insert(orderPayload)
      .select('id, short_id, customer_name, phone, total_amount')
      .single();

    if (orderInsert.error && /reward_points_used|points_used_amount/i.test(orderInsert.error.message || '')) {
      throw new Error('reward_points_migration_required');
    }

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
    createdOrderId = String(order.id);

    const { error: itemsError } = await supabase
      .from('store_order_items')
      .insert(orderItems.map((item: Record<string, unknown>) => ({
        ...item,
        store_order_id: order.id,
      })));

    if (itemsError) throw itemsError;

    if (printDraftsForOrder.length > 0) {
      orderedPrintDraftIds = printDraftsForOrder.map((item) => String(item.id));
      const { error: printDraftError } = await supabase
        .from('print_drafts')
        .update({
          status: 'ordered',
          store_order_id: order.id,
          customer_id: verifiedCustomerId,
          updated_at: new Date().toISOString(),
        })
        .in('id', orderedPrintDraftIds);
      if (printDraftError) throw printDraftError;
    }

    if (requestedRewardPoints > 0 && rewardWalletId) {
      const { error: rewardError } = await supabase.rpc('set_reward_points_redemption', {
        p_wallet_id: rewardWalletId,
        p_source_type: 'store_order',
        p_source_id: order.id,
        p_requested_points: requestedRewardPoints,
        p_order_value: finalTotal,
      });
      if (rewardError) throw rewardError;
      redeemedRewardPoints = true;
    }

    stockReserved = false;
    createdOrderId = null;

    try {
      await sendWhatsAppConfirmation(order, String(customerPin), {
        points: requestedRewardPoints,
        value: pointsUsedAmount,
      });
    } catch (notifyError) {
      console.error('store checkout notification error:', notifyError);
    }

    if (verifiedCustomerEmail) {
      try {
        await sendEmail({
          to: verifiedCustomerEmail,
          subject: `تم استلام طلبك #${String(order.short_id || order.id).slice(0, 6)} - لحظة فن`,
          html: orderEmailHtml(order, String(customerPin), coupon, { points: requestedRewardPoints, value: pointsUsedAmount }),
          text: `تم استلام طلبك من لحظة فن. رقم الطلب: #${String(order.short_id || order.id).slice(0, 6)}. الإجمالي: ${Number(order.total_amount || 0).toFixed(2)} ريال. مدفوع بالنقاط: ${requestedRewardPoints} نقطة (${pointsUsedAmount.toFixed(2)} ريال). المتبقي للدفع: ${Math.max(0, Number(order.total_amount || 0) - pointsUsedAmount).toFixed(2)} ريال. رمز التتبع: ${customerPin}.`,
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
          html: orderEmailHtml(order, String(customerPin), coupon, { points: requestedRewardPoints, value: pointsUsedAmount }),
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
        reward_points_used: requestedRewardPoints,
        points_used_amount: pointsUsedAmount,
        amount_due: Number((finalTotal - pointsUsedAmount).toFixed(2)),
      },
      customer_pin: customerPin,
    });
  } catch (error) {
    console.error('store-checkout error:', error);
    if (redeemedRewardPoints && rewardWalletId && createdOrderId) {
      const { error: restoreRewardError } = await supabase.rpc('set_reward_points_redemption', {
        p_wallet_id: rewardWalletId,
        p_source_type: 'store_order',
        p_source_id: createdOrderId,
        p_requested_points: 0,
        p_order_value: rewardOrderValue,
      });
      if (restoreRewardError) console.error('store-checkout reward restore error:', restoreRewardError);
    }
    if (stockReserved && reservedStockItems.length > 0) {
      const { error: restoreError } = await supabase.rpc('restore_store_stock', {
        items: reservedStockItems,
      });
      if (restoreError) console.error('store-checkout stock restore error:', restoreError);
    }

    if (createdOrderId) {
      const { error: cleanupError } = await supabase
        .from('store_orders')
        .delete()
        .eq('id', createdOrderId);
      if (cleanupError) console.error('store-checkout cleanup error:', cleanupError);
    }
    if (orderedPrintDraftIds.length > 0) {
      const { error: restoreDraftError } = await supabase.from('print_drafts').update({
        status: 'ready', store_order_id: null, customer_id: null, updated_at: new Date().toISOString(),
      }).in('id', orderedPrintDraftIds);
      if (restoreDraftError) console.error('store-checkout print draft restore error:', restoreDraftError);
    }

    const message = error instanceof Error ? error.message : 'checkout_failed';
    const status = ['product_unavailable', 'product_out_of_stock', 'print_draft_not_ready', 'print_draft_locked', 'reward_points_balance_insufficient', 'reward_redemption_limit_exceeded', 'reward_minimum_redemption_not_met'].includes(message)
      ? 409
      : message === 'reward_points_migration_required'
        ? 503
      : ['empty_cart', 'invalid_stock_items', 'not_authorized'].includes(message)
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }
});

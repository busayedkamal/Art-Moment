import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function asOrderList(data: unknown[] | null | undefined, orderType: string) {
  return (data || []).map((order) => ({ ...(order as Record<string, unknown>), order_type: orderType }));
}

function phoneFilterValues(input: unknown) {
  return phoneVariants(normalizeSaudiPhone(input));
}

async function fetchCustomerStats(
  supabase: ReturnType<typeof getServiceClient>,
  variants: string[],
  printOrders: Record<string, unknown>[] = [],
  storeOrders: Record<string, unknown>[] = [],
) {
  const { data: walletsFound, error: walletsError } = await supabase
    .from('wallets')
    .select('id, points_balance')
    .in('phone', variants);

  if (walletsError) throw walletsError;

  const wallets = walletsFound || [];
  const walletIds = wallets.map((wallet: Record<string, unknown>) => wallet.id);
  const points = wallets.reduce((sum: number, wallet: Record<string, unknown>) => sum + Number(wallet.points_balance || 0), 0);

  let packages = 0;
  if (walletIds.length > 0) {
    const { data: packageTransactions, error: packageError } = await supabase
      .from('wallet_transactions')
      .select('type, points, amount_value')
      .in('wallet_id', walletIds)
      .in('type', ['package_charge', 'package_redeem']);

    if (packageError) throw packageError;

    (packageTransactions || []).forEach((tx: Record<string, unknown>) => {
      if (tx.type === 'package_charge') packages += Number(tx.points || 0);
      if (tx.type === 'package_redeem') packages -= Number(tx.amount_value || 0);
    });
  }

  let totalPayments = 0;
  let totalDebt = 0;

  printOrders.forEach((order) => {
    const total = Number(order.total_amount || 0);
    const paid = Number(order.deposit || 0) + Number(order.wallet_used || 0);
    totalPayments += paid;
    totalDebt += Math.max(0, total - paid);
  });

  storeOrders.forEach((order) => {
    const total = Number(order.total_amount || 0);
    const paid = Number(order.amount_paid || 0);
    totalPayments += paid;
    totalDebt += Math.max(0, total - paid);
  });

  return {
    points,
    packages: Math.max(0, packages),
    totalPayments,
    totalDebt,
  };
}

async function fetchPaymentsMap(supabase: ReturnType<typeof getServiceClient>, printOrders: Record<string, unknown>[]) {
  const printIds = printOrders.map((order) => order.id).filter(Boolean);
  if (printIds.length === 0) return {};

  const { data: payments, error } = await supabase
    .from('order_payments')
    .select('id, order_id, amount, payment_date, note, created_at')
    .in('order_id', printIds)
    .order('payment_date', { ascending: true });

  if (error) throw error;

  return (payments || []).reduce((map: Record<string, unknown[]>, payment: Record<string, unknown>) => {
    const key = String(payment.order_id);
    if (!map[key]) map[key] = [];
    map[key].push(payment);
    return map;
  }, {});
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const mode = body?.mode === 'history' ? 'history' : 'id';
    const supabase = getServiceClient();

    if (mode === 'id') {
      const shortId = String(body?.searchId || '').replace('#', '').trim().toLowerCase().slice(0, 6);
      if (!shortId) return jsonResponse({ error: 'missing_order_id' }, 400);

      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').eq('short_id', shortId).maybeSingle(),
        supabase
          .from('store_orders')
          .select('*, store_order_items(quantity, price_at_time, products(name, image))')
          .eq('short_id', shortId)
          .maybeSingle(),
      ]);

      if (printRes.error) throw printRes.error;
      if (storeRes.error) throw storeRes.error;

      const printOrders = printRes.data ? [{ ...printRes.data, order_type: 'print' }] : [];
      const storeOrders = !printRes.data && storeRes.data ? [{ ...storeRes.data, order_type: 'store' }] : [];
      const orders = [...printOrders, ...storeOrders];

      if (orders.length === 0) return jsonResponse({ error: 'order_not_found' }, 404);

      const paymentsMap = await fetchPaymentsMap(supabase, printOrders);
      const variants = orders[0]?.phone ? phoneFilterValues(orders[0].phone) : [];
      const customerStats = variants.length > 0
        ? await fetchCustomerStats(supabase, variants, printOrders, storeOrders)
        : null;

      return jsonResponse({ orders, paymentsMap, customerStats });
    }

    const phone = normalizeSaudiPhone(body?.phone);
    const pin = String(body?.pin || '').trim();
    const variants = phoneFilterValues(phone);

    if (!phone || !pin) return jsonResponse({ error: 'missing_history_credentials' }, 400);

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id')
      .eq('subscription_code', pin)
      .in('phone', variants)
      .limit(1)
      .maybeSingle();

    if (walletError) throw walletError;
    if (!wallet) return jsonResponse({ error: 'invalid_history_credentials' }, 401);

    const [printRes, storeRes] = await Promise.all([
      supabase.from('orders').select('*').in('phone', variants),
      supabase
        .from('store_orders')
        .select('*, store_order_items(quantity, price_at_time, products(name, image))')
        .in('phone', variants),
    ]);

    if (printRes.error) throw printRes.error;
    if (storeRes.error) throw storeRes.error;

    const printOrders = asOrderList(printRes.data, 'print');
    const storeOrders = asOrderList(storeRes.data, 'store');
    const orders = [...printOrders, ...storeOrders].sort(
      (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
    );

    const paymentsMap = await fetchPaymentsMap(supabase, printOrders);
    const customerStats = await fetchCustomerStats(supabase, variants, printOrders, storeOrders);

    return jsonResponse({ orders, paymentsMap, customerStats });
  } catch (error) {
    console.error('track-order error:', error);
    return jsonResponse({ error: 'tracking_failed' }, 500);
  }
});

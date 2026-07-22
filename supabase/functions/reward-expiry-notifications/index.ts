import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

type ServiceClient = ReturnType<typeof getServiceClient>;
type Row = Record<string, any>;

function getBearerToken(req: Request) {
  const match = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function getAdmin(req: Request, supabase: ServiceClient) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, email');
  if (adminError) throw adminError;
  if (!admins?.length) return data.user;

  const email = String(data.user.email || '').toLowerCase();
  return admins.some((admin: Row) => (
    String(admin.user_id || '') === data.user.id
    || String(admin.email || '').toLowerCase() === email
  )) ? data.user : null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function riyadhDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateDifferenceInRiyadh(value: string | Date) {
  const today = Date.parse(`${riyadhDateKey(new Date())}T00:00:00Z`);
  const target = Date.parse(`${riyadhDateKey(value)}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}

function groupLots(lots: Row[]) {
  const groups = new Map<string, Row>();
  lots.forEach((lot) => {
    const days = dateDifferenceInRiyadh(lot.reward_expires_at);
    const expiresOn = riyadhDateKey(lot.reward_expires_at);
    const key = `${lot.wallet_id}:${days}:${expiresOn}`;
    const current = groups.get(key) || {
      walletId: lot.wallet_id,
      reminderDays: Math.max(0, days),
      expiresOn,
      expiresAt: lot.reward_expires_at,
      points: 0,
      lotIds: [],
    };
    current.points += Number(lot.reward_points_remaining || 0);
    current.lotIds.push(lot.id);
    groups.set(key, current);
  });
  return [...groups.values()];
}

async function fetchExpiringLots(supabase: ServiceClient, until: string) {
  const pageSize = 1000;
  const lots: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('id, wallet_id, reward_points_remaining, reward_expires_at')
      .gt('reward_points_remaining', 0)
      .gt('reward_expires_at', new Date().toISOString())
      .lte('reward_expires_at', until)
      .order('reward_expires_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    lots.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return lots;
}

async function fetchAllCustomers(supabase: ServiceClient) {
  const pageSize = 1000;
  const customers: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    customers.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return customers;
}

async function fetchWalletsByIds(supabase: ServiceClient, walletIds: Array<string | number>) {
  const batchSize = 250;
  const wallets: Row[] = [];
  for (let offset = 0; offset < walletIds.length; offset += batchSize) {
    const { data, error } = await supabase
      .from('wallets')
      .select('id, phone')
      .in('id', walletIds.slice(offset, offset + batchSize));
    if (error) throw error;
    wallets.push(...(data || []));
  }
  return wallets;
}

async function createMessageLog(
  supabase: ServiceClient,
  customer: Row,
  group: Row,
  status: 'sent' | 'failed' | 'skipped',
  subject: string,
  body: string,
  errorMessage: string | null = null,
) {
  await supabase.from('customer_message_logs').insert({
    customer_id: customer.id,
    channel: 'email',
    type: `reward_points_expiry_${group.reminderDays}`,
    subject,
    body,
    status,
    error_message: errorMessage,
    metadata: {
      wallet_id: group.walletId,
      points: group.points,
      expires_on: group.expiresOn,
      reminder_days: group.reminderDays,
    },
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });
}

async function sendReminder(
  supabase: ServiceClient,
  customer: Row,
  group: Row,
  pointValue: number,
  triggerType: 'automatic' | 'manual',
) {
  const valueSar = Number((Number(group.points || 0) * pointValue).toFixed(2));
  const subject = group.reminderDays <= 7
    ? `تنبيه أخير: ${Number(group.points).toLocaleString()} نقطة ستنتهي قريباً`
    : `لديك ${Number(group.points).toLocaleString()} نقطة ستنتهي خلال ${group.reminderDays} يوماً`;
  const text = [
    `مرحباً ${customer.name || 'عميل لحظة فن'}،`,
    `لديك ${Number(group.points).toLocaleString()} نقطة بقيمة ${valueSar.toFixed(2)} ر.س ستنتهي بتاريخ ${group.expiresOn}.`,
    'يمكنك استخدامها في طلب متجر مؤهل قبل انتهاء صلاحيتها. يبدأ الاستبدال من 500 نقطة وبحد أقصى 25% من قيمة المنتجات.',
  ].join('\n');

  const { data: queued, error: queueError } = await supabase
    .from('reward_expiry_notifications')
    .insert({
      customer_id: customer.id,
      wallet_id: group.walletId,
      trigger_type: triggerType,
      reminder_days: group.reminderDays,
      expires_on: group.expiresOn,
      points: group.points,
      value_sar: valueSar,
      recipient_email: customer.email,
      status: 'queued',
      metadata: { lot_ids: group.lotIds },
    })
    .select('id')
    .single();

  if (queueError) {
    if (queueError.code === '23505' && triggerType === 'automatic') return { status: 'duplicate' };
    throw queueError;
  }

  if (!customer.email) {
    await supabase.from('reward_expiry_notifications').update({
      status: 'skipped',
      error_message: 'customer_email_missing',
      updated_at: new Date().toISOString(),
    }).eq('id', queued.id);
    await createMessageLog(supabase, customer, group, 'skipped', subject, text, 'customer_email_missing');
    return { status: 'skipped' };
  }

  try {
    const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') || 'https://art-moment.com').replace(/\/$/, '');
    const result = await sendEmail({
      to: customer.email,
      subject,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A;background:#F8F5F2;padding:28px">
          <div style="max-width:580px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:18px;overflow:hidden">
            <div style="background:#4A4A4A;color:#fff;padding:24px 28px">
              <div style="color:#C5A059;font-weight:700">لحظة فن Art Moment</div>
              <h2 style="margin:8px 0 0">نقاطك تستحق أن تُستخدم</h2>
            </div>
            <div style="padding:28px">
              <p>مرحباً ${escapeHtml(customer.name || 'عميل لحظة فن')}،</p>
              <div style="background:#F8F5F2;border:1px solid #ead8da;border-radius:14px;padding:18px;text-align:center;margin:18px 0">
                <strong style="display:block;font-size:30px;color:#D9A3AA">${Number(group.points).toLocaleString()} نقطة</strong>
                <span>تعادل ${valueSar.toFixed(2)} ر.س · تنتهي في ${escapeHtml(group.expiresOn)}</span>
              </div>
              <p>استخدميها في طلب متجر مؤهل قبل انتهاء الصلاحية. يبدأ الاستبدال من 500 نقطة وبحد أقصى 25% من قيمة المنتجات.</p>
              <a href="${siteUrl}/store/orders" style="display:inline-block;background:#4A4A4A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700">عرض طلباتي ونقاطي</a>
            </div>
          </div>
        </div>
      `,
      text,
      tags: [{ name: 'type', value: `reward_expiry_${group.reminderDays}` }],
    });
    await supabase.from('reward_expiry_notifications').update({
      status: 'sent',
      attempts: 1,
      provider_id: String((result as Row)?.id || ''),
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', queued.id);
    await createMessageLog(supabase, customer, group, 'sent', subject, text);
    return { status: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'email_send_failed';
    await supabase.from('reward_expiry_notifications').update({
      status: 'failed',
      attempts: 1,
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq('id', queued.id);
    await createMessageLog(supabase, customer, group, 'failed', subject, text, message);
    return { status: 'failed', error: message };
  }
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'manual' ? 'manual' : 'daily';
    const cronSecret = req.headers.get('x-reward-cron-secret') || '';
    const expectedCronSecret = Deno.env.get('REWARD_CRON_SECRET') || '';
    const isCron = mode === 'daily' && expectedCronSecret && cronSecret === expectedCronSecret;
    const admin = isCron ? null : await getAdmin(req, supabase);
    if (!isCron && !admin) return jsonResponse({ error: 'unauthorized' }, 401);

    await supabase.rpc('expire_reward_points', { p_wallet_id: null });
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('reward_program_enabled, reward_point_value')
      .eq('id', 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.reward_program_enabled === false) return jsonResponse({ ok: true, skipped: 'reward_program_disabled' });
    const pointValue = Number(settings?.reward_point_value || 0.01);

    let groups: Row[] = [];
    let customers: Row[] = [];
    let wallets: Row[] = [];

    if (mode === 'manual') {
      const customerId = String(body?.customerId || '');
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('id', customerId)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return jsonResponse({ error: 'customer_not_found' }, 404);

      const { data: foundWallets, error: walletError } = await supabase
        .from('wallets')
        .select('id, phone, reward_points_balance')
        .in('phone', phoneVariants(customer.phone));
      if (walletError) throw walletError;
      const wallet = (foundWallets || []).sort((a, b) => Number(b.reward_points_balance || 0) - Number(a.reward_points_balance || 0))[0];
      if (!wallet) return jsonResponse({ error: 'reward_wallet_not_found' }, 404);

      const { data: lots, error: lotsError } = await supabase
        .from('wallet_transactions')
        .select('id, wallet_id, reward_points_remaining, reward_expires_at')
        .eq('wallet_id', wallet.id)
        .gt('reward_points_remaining', 0)
        .gt('reward_expires_at', new Date().toISOString())
        .order('reward_expires_at', { ascending: true });
      if (lotsError) throw lotsError;
      const withinThirtyDays = (lots || []).filter((lot: Row) => dateDifferenceInRiyadh(lot.reward_expires_at) <= 30);
      const selectedLots = withinThirtyDays.length > 0 ? withinThirtyDays : (lots || []).slice(0, 1);
      if (selectedLots.length === 0) return jsonResponse({ error: 'no_expiring_reward_points' }, 409);

      const groupedLots = groupLots(selectedLots);
      groups = [groupedLots[0]];
      customers = [customer];
      wallets = [wallet];
    } else {
      const until = new Date(Date.now() + 31 * 86400000).toISOString();
      const lots = await fetchExpiringLots(supabase, until);
      groups = groupLots(lots).filter((group) => [30, 7].includes(Number(group.reminderDays)));
      const walletIds = [...new Set(groups.map((group) => group.walletId))];
      if (walletIds.length === 0) return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: 0 });

      const [foundWallets, foundCustomers] = await Promise.all([
        fetchWalletsByIds(supabase, walletIds),
        fetchAllCustomers(supabase),
      ]);
      wallets = foundWallets;
      customers = foundCustomers;
    }

    const customerByPhone = new Map(customers.map((customer) => [normalizeSaudiPhone(customer.phone), customer]));
    const walletById = new Map(wallets.map((wallet) => [String(wallet.id), wallet]));
    const results: Row[] = [];

    for (const group of groups) {
      const wallet = walletById.get(String(group.walletId));
      const customer = wallet ? customerByPhone.get(normalizeSaudiPhone(wallet.phone)) : null;
      if (!customer) {
        results.push({ status: 'skipped', reason: 'customer_not_found' });
        continue;
      }
      results.push(await sendReminder(supabase, customer, group, pointValue, mode === 'manual' ? 'manual' : 'automatic'));
    }

    if (admin && mode === 'manual') {
      await supabase.from('admin_activity_logs').insert({
        actor_user_id: admin.id,
        actor_email: admin.email || null,
        action: 'reward_expiry_reminder_sent',
        entity_type: 'customer',
        entity_id: String(body?.customerId || ''),
        new_values: { results },
        metadata: { source: 'customers_page' },
      });
    }

    return jsonResponse({
      ok: true,
      sent: results.filter((result) => result.status === 'sent').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => ['skipped', 'duplicate'].includes(result.status)).length,
      results,
    });
  } catch (error) {
    console.error('reward-expiry-notifications error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'reward_expiry_notifications_failed' }, 500);
  }
});

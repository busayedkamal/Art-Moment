import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { createPasswordHash, verifyPassword } from '../_shared/password.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const CONTACT_METHODS = new Set(['whatsapp', 'email', 'phone']);
const MAX_ADDRESSES = 5;

type AddressInput = {
  id?: unknown;
  label?: unknown;
  city?: unknown;
  district?: unknown;
  street?: unknown;
  notes?: unknown;
};

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function cleanText(value: unknown, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeAddress(address: AddressInput) {
  const id = cleanText(address.id, 64) || crypto.randomUUID();
  const label = cleanText(address.label, 60) || 'العنوان الرئيسي';
  const city = cleanText(address.city, 80);
  const district = cleanText(address.district, 80);
  const street = cleanText(address.street, 180);
  const notes = cleanText(address.notes, 240);

  if (!city && !district && !street && !notes) return null;

  return {
    id,
    label,
    city,
    district,
    street,
    notes,
  };
}

function normalizeAddresses(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_ADDRESSES)
    .map((address) => normalizeAddress(address as AddressInput))
    .filter(Boolean);
}

function safeCustomer(customer: Record<string, unknown>) {
  return {
    id: customer.id,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    marketingOptIn: Boolean(customer.marketing_opt_in),
    preferredContactMethod: customer.preferred_contact_method || 'whatsapp',
    savedAddresses: Array.isArray(customer.saved_addresses) ? customer.saved_addresses : [],
    createdAt: customer.created_at || null,
    lastLoginAt: customer.last_login_at || null,
    profileUpdatedAt: customer.profile_updated_at || null,
    dataDeletionRequestedAt: customer.data_deletion_requested_at || null,
  };
}

async function fetchCustomer(
  supabase: ReturnType<typeof getServiceClient>,
  sessionToken: unknown,
  includePassword = false,
) {
  const tokenPayload = await verifyCustomerSessionToken(sessionToken);
  if (!tokenPayload?.sub) return null;

  const passwordField = includePassword ? ', password_hash' : '';
  const { data, error } = await supabase
    .from('customers')
    .select(`id, name, email, phone, marketing_opt_in, preferred_contact_method, saved_addresses, created_at, last_login_at, profile_updated_at, data_deletion_requested_at${passwordField}`)
    .eq('id', tokenPayload.sub)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function fetchRewardSummary(
  supabase: ReturnType<typeof getServiceClient>,
  phone: unknown,
) {
  const normalizedPhone = normalizeSaudiPhone(phone);
  if (!isValidSaudiMobile(normalizedPhone)) return null;

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('reward_program_enabled, reward_point_value, reward_minimum_redemption_points, reward_maximum_redemption_percent, reward_expiry_months')
    .eq('id', 1)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const { data: wallets, error: walletError } = await supabase
    .from('wallets')
    .select('id, reward_points_balance, points_balance, store_credit_balance')
    .in('phone', phoneVariants(normalizedPhone));
  if (walletError) throw walletError;

  const wallet = (wallets || []).sort((left, right) => {
    const leftPoints = Number(left.reward_points_balance ?? Math.round(Number(left.points_balance || 0) / 0.01));
    const rightPoints = Number(right.reward_points_balance ?? Math.round(Number(right.points_balance || 0) / 0.01));
    return rightPoints - leftPoints || Number(right.id || 0) - Number(left.id || 0);
  })[0];

  const pointValue = Number(settings?.reward_point_value || 0.01);
  if (!wallet) {
    return {
      enabled: settings?.reward_program_enabled !== false,
      points: 0,
      pointValue,
      valueSar: 0,
      storeCreditSar: 0,
      minimumRedemptionPoints: Number(settings?.reward_minimum_redemption_points || 500),
      maximumRedemptionPercent: Number(settings?.reward_maximum_redemption_percent || 25),
      expiryMonths: Number(settings?.reward_expiry_months || 4),
      expiringSoonPoints: 0,
      nextExpiryAt: null,
    };
  }

  await supabase.rpc('expire_reward_points', { p_wallet_id: wallet.id });

  const { data: refreshedWallet, error: refreshedWalletError } = await supabase
    .from('wallets')
    .select('reward_points_balance, points_balance, store_credit_balance')
    .eq('id', wallet.id)
    .single();
  if (refreshedWalletError) throw refreshedWalletError;

  const inThirtyDays = new Date();
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const { data: expiringLots, error: expiringError } = await supabase
    .from('wallet_transactions')
    .select('reward_points_remaining, reward_expires_at')
    .eq('wallet_id', wallet.id)
    .gt('reward_points_remaining', 0)
    .gt('reward_expires_at', new Date().toISOString())
    .lte('reward_expires_at', inThirtyDays.toISOString())
    .order('reward_expires_at', { ascending: true });
  if (expiringError) throw expiringError;

  const points = Number(refreshedWallet.reward_points_balance
    ?? Math.round(Number(refreshedWallet.points_balance || 0) / pointValue));
  return {
    enabled: settings?.reward_program_enabled !== false,
    points,
    pointValue,
    valueSar: Number((points * pointValue).toFixed(2)),
    storeCreditSar: Number(refreshedWallet.store_credit_balance || 0),
    minimumRedemptionPoints: Number(settings?.reward_minimum_redemption_points || 500),
    maximumRedemptionPercent: Number(settings?.reward_maximum_redemption_percent || 25),
    expiryMonths: Number(settings?.reward_expiry_months || 4),
    expiringSoonPoints: (expiringLots || []).reduce(
      (sum, lot) => sum + Number(lot.reward_points_remaining || 0),
      0,
    ),
    nextExpiryAt: expiringLots?.[0]?.reward_expires_at || null,
  };
}

async function ensureUniqueProfile(
  supabase: ReturnType<typeof getServiceClient>,
  customerId: unknown,
  phone: string,
  email: string,
) {
  const { data: existingPhone, error: phoneError } = await supabase
    .from('customers')
    .select('id')
    .in('phone', phoneVariants(phone))
    .neq('id', customerId)
    .limit(1)
    .maybeSingle();
  if (phoneError) throw phoneError;
  if (existingPhone) return 'phone_exists';

  const { data: existingEmail, error: emailError } = await supabase
    .from('customers')
    .select('id')
    .ilike('email', email)
    .neq('id', customerId)
    .limit(1)
    .maybeSingle();
  if (emailError) throw emailError;
  if (existingEmail) return 'email_exists';

  return null;
}

async function notifyCustomer(email: unknown, subject: string, body: string) {
  const to = String(email || '').trim();
  if (!to) return;

  await sendEmail({
    to,
    subject,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A;background:#F8F5F2;padding:28px">
        <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:22px;padding:26px">
          <p style="margin:0 0 8px;color:#C5A059;font-weight:700">لحظة فن Art Moment</p>
          <h2 style="margin:0 0 14px;color:#4A4A4A">${escapeHtml(subject)}</h2>
          <p style="margin:0">${escapeHtml(body)}</p>
        </div>
      </div>
    `,
    text: body,
    tags: [{ name: 'type', value: 'customer_account' }],
  });
}

async function notifyAdmin(subject: string, body: string) {
  const to = Deno.env.get('CUSTOMER_ACCOUNT_NOTIFY_EMAIL')
    || Deno.env.get('RETURN_REQUEST_NOTIFY_EMAIL')
    || Deno.env.get('ADMIN_NOTIFY_EMAIL');

  if (!to) return;

  await sendEmail({
    to,
    subject,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A;background:#F8F5F2;padding:28px">
        <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:22px;padding:26px">
          <p style="margin:0 0 8px;color:#C5A059;font-weight:700">لحظة فن Art Moment</p>
          <h2 style="margin:0 0 14px;color:#4A4A4A">${escapeHtml(subject)}</h2>
          <p style="margin:0;white-space:pre-line">${escapeHtml(body)}</p>
        </div>
      </div>
    `,
    text: body,
    tags: [{ name: 'type', value: 'customer_account_admin' }],
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
    const action = String(body?.action || 'get');
    const supabase = getServiceClient();

    const customer = await fetchCustomer(supabase, body?.sessionToken, action === 'change_password');
    if (!customer) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    if (action === 'get') {
      const rewards = await fetchRewardSummary(supabase, customer.phone);
      return jsonResponse({ customer: safeCustomer(customer), rewards });
    }

    if (action === 'update_profile') {
      const phone = normalizeSaudiPhone(body?.phone);
      const email = normalizeEmail(body?.email);
      const name = cleanText(body?.name, 120);
      const preferredContactMethod = cleanText(body?.preferredContactMethod, 20) || 'whatsapp';

      if (!name || !email || !isValidSaudiMobile(phone) || !CONTACT_METHODS.has(preferredContactMethod)) {
        return jsonResponse({ error: 'invalid_profile' }, 400);
      }

      const duplicateError = await ensureUniqueProfile(supabase, customer.id, phone, email);
      if (duplicateError) {
        return jsonResponse({ error: duplicateError }, 409);
      }

      const savedAddresses = normalizeAddresses(body?.savedAddresses);
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          name,
          email,
          phone,
          marketing_opt_in: Boolean(body?.marketingOptIn),
          preferred_contact_method: preferredContactMethod,
          saved_addresses: savedAddresses,
          profile_updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id)
        .select('id, name, email, phone, marketing_opt_in, preferred_contact_method, saved_addresses, created_at, last_login_at, profile_updated_at, data_deletion_requested_at')
        .single();

      if (updateError) throw updateError;

      try {
        await notifyCustomer(email, 'تم تحديث بيانات حسابك', 'تم تحديث بيانات حسابك في لحظة فن بنجاح.');
      } catch (emailError) {
        console.error('customer profile email error:', emailError);
      }

      return jsonResponse({ customer: safeCustomer(updatedCustomer as Record<string, unknown>) });
    }

    if (action === 'change_password') {
      const currentPassword = String(body?.currentPassword || '');
      const nextPassword = String(body?.newPassword || '');

      if (nextPassword.length < 6) {
        return jsonResponse({ error: 'weak_password' }, 400);
      }

      const passwordCheck = await verifyPassword(currentPassword, String(customer.password_hash || ''));
      if (!passwordCheck.valid) {
        return jsonResponse({ error: 'invalid_current_password' }, 400);
      }

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          password_hash: await createPasswordHash(nextPassword),
          profile_updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      try {
        await notifyCustomer(customer.email, 'تم تغيير كلمة المرور', 'تم تغيير كلمة مرور حسابك في لحظة فن. إذا لم تقومي بهذا الإجراء تواصلي معنا فوراً.');
      } catch (emailError) {
        console.error('customer password email error:', emailError);
      }

      return jsonResponse({ ok: true });
    }

    if (action === 'request_data_deletion') {
      const requestedAt = new Date().toISOString();
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({
          data_deletion_requested_at: requestedAt,
          data_deletion_reviewed_at: null,
          data_deletion_review_note: null,
          admin_status: 'needs_followup',
        })
        .eq('id', customer.id)
        .select('id, name, email, phone, marketing_opt_in, preferred_contact_method, saved_addresses, created_at, last_login_at, profile_updated_at, data_deletion_requested_at')
        .single();

      if (updateError) throw updateError;

      try {
        await notifyCustomer(customer.email, 'تم استلام طلب حذف البيانات', 'وصلنا طلب حذف بيانات حسابك، وسيتم مراجعته من الإدارة قبل أي إجراء نهائي.');
      } catch (emailError) {
        console.error('customer deletion email error:', emailError);
      }

      try {
        await notifyAdmin(
          `طلب حذف بيانات عميل #${String(customer.id).slice(0, 8)}`,
          [
            `العميل: ${String(customer.name || 'عميل لحظة فن')}`,
            `الجوال: ${String(customer.phone || '-')}`,
            `البريد: ${String(customer.email || '-')}`,
            `وقت الطلب: ${requestedAt}`,
            '',
            'يرجى مراجعة الطلب من لوحة العملاء قبل تنفيذ أي إجراء نهائي.',
          ].join('\n'),
        );
      } catch (emailError) {
        console.error('customer deletion admin email error:', emailError);
      }

      return jsonResponse({ customer: safeCustomer(updatedCustomer as Record<string, unknown>) });
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('customer-account error:', error);
    return jsonResponse({ error: 'customer_account_failed' }, 500);
  }
});

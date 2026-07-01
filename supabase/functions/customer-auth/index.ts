import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { createCustomerSessionToken } from '../_shared/customerToken.ts';
import { sendEmail } from '../_shared/email.ts';
import { createPasswordHash, verifyPassword } from '../_shared/password.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const RESET_CODE_TTL_MINUTES = 15;
const RESET_COOLDOWN_SECONDS = 120;

type CustomerRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  password_reset_token_hash?: string | null;
  password_reset_expires_at?: string | null;
  password_reset_sent_at?: string | null;
};

function safeCustomer(customer: Record<string, unknown>) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    marketingOptIn: customer.marketing_opt_in ?? false,
  };
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getIdentifier(body: Record<string, unknown>) {
  return String(body?.identifier ?? body?.phone ?? body?.email ?? '').trim();
}

function isEmailIdentifier(identifier: string) {
  return identifier.includes('@');
}

async function hashResetCode(customerId: string, code: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${customerId}:${code.trim()}`),
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function createResetCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(6, '0');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function passwordResetEmailHtml(name: string | null | undefined, code: string) {
  const customerName = escapeHtml(name || 'عميل لحظة فن');
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; background:#F8F5F2; padding:32px; color:#4A4A4A;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:24px; padding:32px; border:1px solid #ead8da;">
        <p style="margin:0 0 12px; color:#C5A059; font-weight:700;">لحظة فن Art Moment</p>
        <h1 style="margin:0 0 16px; font-size:24px;">استرداد كلمة المرور</h1>
        <p style="line-height:1.8; margin:0 0 20px;">مرحباً ${customerName}، استخدم الكود التالي لتعيين كلمة مرور جديدة لحسابك:</p>
        <div dir="ltr" style="font-size:32px; letter-spacing:8px; font-weight:800; text-align:center; background:#F8F5F2; color:#4A4A4A; border-radius:16px; padding:18px; margin:24px 0;">${code}</div>
        <p style="line-height:1.8; margin:0;">ينتهي هذا الكود خلال ${RESET_CODE_TTL_MINUTES} دقيقة. إذا لم تطلب تغيير كلمة المرور، تجاهل هذه الرسالة.</p>
      </div>
    </div>
  `;
}

async function findCustomerByIdentifier(supabase: ReturnType<typeof getServiceClient>, identifier: string) {
  if (!identifier) return null;

  if (isEmailIdentifier(identifier)) {
    const email = normalizeEmail(identifier);
    if (!email) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, password_hash, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, marketing_opt_in')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as CustomerRecord | null;
  }

  const phone = normalizeSaudiPhone(identifier);
  if (!isValidSaudiMobile(phone)) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, password_hash, password_reset_token_hash, password_reset_expires_at, password_reset_sent_at, marketing_opt_in')
    .in('phone', phoneVariants(phone))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as CustomerRecord | null;
}

function genericResetResponse() {
  return jsonResponse({
    ok: true,
    message: 'if_account_exists_email_was_sent',
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
    const mode = String(body?.mode ?? 'login');
    const supabase = getServiceClient();

    if (mode === 'request_password_reset') {
      const customer = await findCustomerByIdentifier(supabase, getIdentifier(body));
      if (!customer?.email) return genericResetResponse();

      const lastSentAt = customer.password_reset_sent_at
        ? new Date(customer.password_reset_sent_at).getTime()
        : 0;
      if (Date.now() - lastSentAt < RESET_COOLDOWN_SECONDS * 1000) {
        return genericResetResponse();
      }

      const code = createResetCode();
      const tokenHash = await hashResetCode(customer.id, code);
      const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          password_reset_token_hash: tokenHash,
          password_reset_expires_at: expiresAt,
          password_reset_sent_at: new Date().toISOString(),
          password_reset_used_at: null,
        })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      await sendEmail({
        to: customer.email,
        subject: 'كود استرداد كلمة المرور - لحظة فن',
        html: passwordResetEmailHtml(customer.name, code),
        text: `كود استرداد كلمة المرور في لحظة فن: ${code}. ينتهي خلال ${RESET_CODE_TTL_MINUTES} دقيقة.`,
        tags: [{ name: 'type', value: 'customer_password_reset' }],
      });

      return genericResetResponse();
    }

    if (mode === 'reset_password') {
      const customer = await findCustomerByIdentifier(supabase, getIdentifier(body));
      const code = String(body?.code ?? '').trim();
      const password = String(body?.password ?? '');

      if (!customer || !code || password.length < 6) {
        return jsonResponse({ error: 'invalid_reset_code' }, 400);
      }

      const expectedHash = await hashResetCode(customer.id, code);
      const expiresAt = customer.password_reset_expires_at
        ? new Date(customer.password_reset_expires_at).getTime()
        : 0;

      if (
        !customer.password_reset_token_hash ||
        !timingSafeEqual(customer.password_reset_token_hash, expectedHash) ||
        !expiresAt ||
        Date.now() > expiresAt
      ) {
        return jsonResponse({ error: 'invalid_reset_code' }, 400);
      }

      const passwordHash = await createPasswordHash(password);
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          password_hash: passwordHash,
          password_reset_token_hash: null,
          password_reset_expires_at: null,
          password_reset_used_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (updateError) throw updateError;
      return jsonResponse({ ok: true });
    }

    if (mode === 'signup') {
      const phone = normalizeSaudiPhone(body?.phone);
      const password = String(body?.password ?? '');
      const email = normalizeEmail(body?.email);
      const name = String(body?.name ?? '').trim() || null;
      const marketingOptIn = Boolean(body?.marketingOptIn);

      if (!isValidSaudiMobile(phone) || !email || password.length < 6) {
        return jsonResponse({ error: 'invalid_credentials' }, 400);
      }

      const { data: existingPhone, error: phoneError } = await supabase
        .from('customers')
        .select('id')
        .in('phone', phoneVariants(phone))
        .limit(1)
        .maybeSingle();
      if (phoneError) throw phoneError;

      const { data: existingEmail, error: emailError } = await supabase
        .from('customers')
        .select('id')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      if (emailError) throw emailError;

      if (existingPhone || existingEmail) {
        return jsonResponse({ error: 'customer_exists' }, 409);
      }

      const passwordHash = await createPasswordHash(password);
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({
          name,
          email,
          phone,
          password_hash: passwordHash,
          marketing_opt_in: marketingOptIn,
        })
        .select('id, name, email, phone, marketing_opt_in')
        .single();

      if (insertError) throw insertError;
      return jsonResponse({
        customer: safeCustomer(newCustomer),
        sessionToken: await createCustomerSessionToken(String(newCustomer.id)),
      });
    }

    const customer = await findCustomerByIdentifier(supabase, getIdentifier(body));
    const password = String(body?.password ?? '');
    const passwordCheck = await verifyPassword(password, customer?.password_hash);

    if (!customer || !passwordCheck.valid) {
      return jsonResponse({ error: 'invalid_credentials' }, 401);
    }

    const updates: Record<string, string> = {
      last_login_at: new Date().toISOString(),
    };
    if (passwordCheck.legacy) updates.password_hash = await createPasswordHash(password);
    if (customer.phone && customer.phone !== normalizeSaudiPhone(customer.phone)) {
      updates.phone = normalizeSaudiPhone(customer.phone);
    }

    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customer.id)
      .select('id, name, email, phone, marketing_opt_in')
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      customer: safeCustomer(updatedCustomer),
      sessionToken: await createCustomerSessionToken(String(updatedCustomer.id)),
    });
  } catch (error) {
    console.error('customer-auth error:', error);
    const publicErrors = new Set(['email_send_failed']);
    const message = error instanceof Error && publicErrors.has(error.message)
      ? error.message
      : 'auth_failed';
    return jsonResponse({ error: message }, 500);
  }
});

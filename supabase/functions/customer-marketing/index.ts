import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { getServiceClient } from '../_shared/supabase.ts';

type CustomerRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  marketing_opt_in?: boolean | null;
};

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function isAdminRequest(req: Request, supabase: ReturnType<typeof getServiceClient>) {
  const token = getBearerToken(req);
  if (!token) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return false;

  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, email');
  if (adminError) throw adminError;

  if (!admins || admins.length === 0) return true;
  const userEmail = String(user.email || '').toLowerCase();
  return admins.some((admin: Record<string, unknown>) => (
    String(admin.user_id || '') === user.id
    || String(admin.email || '').toLowerCase() === userEmail
  ));
}

function cleanText(value: unknown, maxLength = 2000) {
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

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getSigningSecret() {
  const secret = Deno.env.get('MARKETING_UNSUBSCRIBE_SECRET')
    || Deno.env.get('CUSTOMER_SESSION_SECRET')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('marketing_secret_missing');
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function signTokenPayload(data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createUnsubscribeToken(customerId: string) {
  const payload = textToBase64Url(JSON.stringify({
    aud: 'marketing_unsubscribe',
    iat: Math.floor(Date.now() / 1000),
    sub: customerId,
  }));
  const signature = await signTokenPayload(payload);
  return `${payload}.${signature}`;
}

async function verifyUnsubscribeToken(token: unknown) {
  try {
    const value = String(token || '').trim();
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;

    const expectedSignature = await signTokenPayload(payload);
    if (!timingSafeEqual(signature, expectedSignature)) return null;

    const parsed = JSON.parse(base64UrlToText(payload)) as { aud?: string; sub?: string };
    if (parsed.aud !== 'marketing_unsubscribe' || !parsed.sub) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

function getPublicSiteUrl(req: Request) {
  return (Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_BASE_URL') || req.headers.get('origin') || 'https://art-moment.com').replace(/\/+$/, '');
}

function campaignEmailHtml(input: {
  title: string;
  body: string;
  customerName: string;
  unsubscribeUrl: string;
}) {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#4A4A4A;background:#F8F5F2;padding:28px">
      <div style="max-width:580px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:24px;padding:28px">
        <p style="margin:0 0 8px;color:#C5A059;font-weight:700">لحظة فن Art Moment</p>
        <h2 style="margin:0 0 14px;color:#4A4A4A">${escapeHtml(input.title)}</h2>
        <p style="margin:0 0 18px">مرحباً ${escapeHtml(input.customerName || 'عميل لحظة فن')}،</p>
        <div style="white-space:pre-line;margin:0 0 22px">${escapeHtml(input.body)}</div>
        <a href="${escapeHtml(input.unsubscribeUrl)}" style="font-size:12px;color:#777;text-decoration:underline">إلغاء الاشتراك في الرسائل التسويقية</a>
      </div>
    </div>
  `;
}

function renderTemplate(value: string, variables: Record<string, string>) {
  return String(value || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  ));
}

async function logMessage(
  supabase: ReturnType<typeof getServiceClient>,
  row: Record<string, unknown>,
) {
  const { error } = await supabase.from('customer_message_logs').insert(row);
  if (error && !/customer_message_logs|schema cache|relation|does not exist/i.test(error.message || '')) {
    throw error;
  }
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '').trim();
    const supabase = getServiceClient();

    if (action === 'unsubscribe') {
      const customerId = await verifyUnsubscribeToken(body?.token);
      if (!customerId) return jsonResponse({ error: 'invalid_unsubscribe_token' }, 400);

      const unsubscribedAt = new Date().toISOString();
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .update({
          marketing_opt_in: false,
          marketing_unsubscribed_at: unsubscribedAt,
        })
        .eq('id', customerId)
        .select('id, name, email')
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return jsonResponse({ error: 'customer_not_found' }, 404);

      await logMessage(supabase, {
        customer_id: customer.id,
        channel: 'email',
        type: 'marketing_unsubscribe',
        subject: 'إلغاء الاشتراك',
        body: 'ألغى العميل الاشتراك في الرسائل التسويقية.',
        status: 'completed',
        sent_at: unsubscribedAt,
        metadata: { source: 'unsubscribe_link' },
      });

      return jsonResponse({ ok: true, customer: { name: customer.name || '' } });
    }

    if (action === 'send_campaign') {
      if (!await isAdminRequest(req, supabase)) {
        return jsonResponse({ error: 'unauthorized' }, 401);
      }

      const subject = cleanText(body?.subject, 140);
      const title = cleanText(body?.title || subject, 160);
      const message = cleanText(body?.message, 5000);
      if (!subject || !title || !message) {
        return jsonResponse({ error: 'invalid_campaign' }, 400);
      }

      let query = supabase
        .from('customers')
        .select('id, name, email, marketing_opt_in')
        .eq('marketing_opt_in', true)
        .not('email', 'is', null);

      const customerIds = Array.isArray(body?.customerIds)
        ? body.customerIds.map((id: unknown) => String(id)).filter(Boolean).slice(0, 500)
        : [];
      if (customerIds.length > 0) {
        query = query.in('id', customerIds);
      }

      const { data: customers, error: customersError } = await query;
      if (customersError) throw customersError;

      const recipients = (customers || []).filter((customer: CustomerRow) => (
        customer.marketing_opt_in === true && isValidEmail(customer.email)
      ));

      const campaignId = crypto.randomUUID();
      const siteUrl = getPublicSiteUrl(req);
      let sent = 0;
      let failed = 0;

      for (const customer of recipients) {
        const token = await createUnsubscribeToken(String(customer.id));
        const unsubscribeUrl = `${siteUrl}/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
        const customerName = String(customer.name || 'عميل لحظة فن');
        const variables = {
          customer_name: customerName,
        };
        const personalizedTitle = renderTemplate(title, variables);
        const personalizedMessage = renderTemplate(message, variables);

        try {
          await sendEmail({
            to: String(customer.email),
            subject,
            html: campaignEmailHtml({ title: personalizedTitle, body: personalizedMessage, customerName, unsubscribeUrl }),
            text: `${personalizedTitle}\n\n${personalizedMessage}\n\nإلغاء الاشتراك: ${unsubscribeUrl}`,
            tags: [
              { name: 'type', value: 'marketing_campaign' },
              { name: 'campaign', value: campaignId.slice(0, 32) },
            ],
          });
          sent += 1;
          await logMessage(supabase, {
            customer_id: customer.id,
            channel: 'email',
            type: 'marketing_campaign',
            subject,
            body: personalizedMessage,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { campaignId, title },
          });
        } catch (emailError) {
          failed += 1;
          console.error('marketing email error:', emailError);
          await logMessage(supabase, {
            customer_id: customer.id,
            channel: 'email',
            type: 'marketing_campaign',
            subject,
            body: message,
            status: 'failed',
            error_message: emailError instanceof Error ? emailError.message : 'email_failed',
            metadata: { campaignId, title },
          });
        }
      }

      return jsonResponse({
        campaignId,
        sent,
        failed,
        skipped: Math.max(0, (customers || []).length - recipients.length),
        eligible: recipients.length,
      });
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('customer-marketing error:', error);
    const message = error instanceof Error ? error.message : 'customer_marketing_failed';
    return jsonResponse({ error: message }, 500);
  }
});

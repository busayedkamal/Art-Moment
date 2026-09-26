type SupabaseClientLike = {
  from: (table: string) => any;
};

export type WhatsAppSettings = {
  enabled: boolean;
  apiVersion: string;
  phoneNumberId: string;
  wabaId: string;
  templateLanguage: string;
  orderStatusTemplate: string;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  lastTestedAt?: string;
  lastTestStatus?: string;
  accessTokenConfigured: boolean;
};

const SETTINGS_COLUMNS = [
  'whatsapp_enabled',
  'whatsapp_meta_api_version',
  'whatsapp_phone_number_id',
  'whatsapp_waba_id',
  'whatsapp_template_language',
  'whatsapp_order_status_template',
  'whatsapp_last_tested_at',
  'whatsapp_last_test_status',
  'whatsapp_verified_name',
  'whatsapp_display_phone_number',
  'whatsapp_quality_rating',
].join(', ');

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeApiVersion(value: unknown) {
  const version = clean(value, 16);
  return /^v\d+\.\d+$/.test(version) ? version : 'v26.0';
}

export function normalizeWhatsAppPhone(value: unknown) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `966${digits}`;
  if (/^9665\d{8}$/.test(digits)) return digits;
  return digits;
}

export async function getWhatsAppSettings(supabase: SupabaseClientLike): Promise<WhatsAppSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select(SETTINGS_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  return {
    enabled: data?.whatsapp_enabled === true,
    apiVersion: normalizeApiVersion(data?.whatsapp_meta_api_version),
    phoneNumberId: clean(data?.whatsapp_phone_number_id, 80),
    wabaId: clean(data?.whatsapp_waba_id, 80),
    templateLanguage: clean(data?.whatsapp_template_language, 20) || 'ar',
    orderStatusTemplate: clean(data?.whatsapp_order_status_template, 120) || 'order_status_update',
    verifiedName: clean(data?.whatsapp_verified_name, 160),
    displayPhoneNumber: clean(data?.whatsapp_display_phone_number, 80),
    qualityRating: clean(data?.whatsapp_quality_rating, 40),
    lastTestedAt: clean(data?.whatsapp_last_tested_at, 80),
    lastTestStatus: clean(data?.whatsapp_last_test_status, 40),
    accessTokenConfigured: Boolean(Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')),
  };
}

function getAccessToken() {
  const token = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN');
  if (!token) throw new Error('meta_access_token_missing');
  return token;
}

async function graphRequest(settings: WhatsAppSettings, path: string, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${settings.apiVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `meta_http_${response.status}`;
    throw new Error(`meta_whatsapp_error:${message}`);
  }
  return payload;
}

export async function testWhatsAppConnection(supabase: SupabaseClientLike) {
  const settings = await getWhatsAppSettings(supabase);
  if (!settings.phoneNumberId) throw new Error('meta_phone_number_id_missing');
  const payload = await graphRequest(
    settings,
    `${encodeURIComponent(settings.phoneNumberId)}?fields=verified_name,display_phone_number,quality_rating`,
  );
  return {
    verifiedName: clean(payload?.verified_name, 160),
    displayPhoneNumber: clean(payload?.display_phone_number, 80),
    qualityRating: clean(payload?.quality_rating, 40),
    phoneNumberId: clean(payload?.id, 80) || settings.phoneNumberId,
  };
}

export async function sendWhatsAppStatusTemplate(
  supabase: SupabaseClientLike,
  input: {
    to: unknown;
    customerName: unknown;
    orderNumber: unknown;
    statusLabel: unknown;
    trackingUrl: unknown;
  },
) {
  const settings = await getWhatsAppSettings(supabase);
  if (!settings.enabled) return { skipped: true, reason: 'whatsapp_disabled' };
  if (!settings.phoneNumberId) throw new Error('meta_phone_number_id_missing');
  if (!settings.accessTokenConfigured) throw new Error('meta_access_token_missing');

  const to = normalizeWhatsAppPhone(input.to);
  if (!/^\d{10,15}$/.test(to)) throw new Error('invalid_whatsapp_phone');

  const parameters = [
    clean(input.customerName, 160) || 'عميل لحظة فن',
    clean(input.orderNumber, 80),
    clean(input.statusLabel, 160),
    clean(input.trackingUrl, 500),
  ].map((text) => ({ type: 'text', text }));

  const payload = await graphRequest(settings, `${encodeURIComponent(settings.phoneNumberId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: settings.orderStatusTemplate,
        language: { code: settings.templateLanguage },
        components: [{ type: 'body', parameters }],
      },
    }),
  });

  return {
    skipped: false,
    providerMessageId: clean(payload?.messages?.[0]?.id, 200),
    recipient: to,
  };
}
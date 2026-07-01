const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type CustomerTokenPayload = {
  aud: 'customer';
  exp: number;
  iat: number;
  sub: string;
};

function getSigningSecret() {
  const secret = Deno.env.get('CUSTOMER_SESSION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('customer_session_secret_missing');
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
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

export async function createCustomerSessionToken(customerId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: CustomerTokenPayload = {
    aud: 'customer',
    exp: now + TOKEN_TTL_SECONDS,
    iat: now,
    sub: customerId,
  };
  const encodedPayload = textToBase64Url(JSON.stringify(payload));
  const signature = await signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyCustomerSessionToken(token: unknown) {
  const value = String(token ?? '').trim();
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signTokenPayload(encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  const payload = JSON.parse(base64UrlToText(encodedPayload)) as CustomerTokenPayload;
  if (payload.aud !== 'customer' || !payload.sub || !payload.exp) return null;
  if (Math.floor(Date.now() / 1000) > payload.exp) return null;

  return payload;
}

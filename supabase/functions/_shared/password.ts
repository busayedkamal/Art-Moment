const HASH_PREFIX = 'pbkdf2';
const HASH_ITERATIONS = 150000;

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function legacyObscure(text: string) {
  return bytesToBase64(new TextEncoder().encode(text));
}

async function derivePasswordHash(password: string, saltBytes: Uint8Array, iterations = HASH_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256,
  );
  return bytesToBase64(bits);
}

export async function createPasswordHash(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, saltBytes);
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${bytesToBase64(saltBytes)}$${hash}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return { valid: false, legacy: false };

  if (!storedHash.startsWith(`${HASH_PREFIX}$`)) {
    return { valid: legacyObscure(password) === storedHash, legacy: true };
  }

  const [, iterations, salt, expectedHash] = storedHash.split('$');
  if (!iterations || !salt || !expectedHash) return { valid: false, legacy: false };

  const actualHash = await derivePasswordHash(password, base64ToBytes(salt), Number(iterations));
  return { valid: actualHash === expectedHash, legacy: false };
}

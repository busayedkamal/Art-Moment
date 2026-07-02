const CUSTOMER_SESSION_KEY = 'art_moment_customer';
const CUSTOMER_REMEMBER_KEY = 'art_moment_customer_remember';

const storageList = () => [window.sessionStorage, window.localStorage];

export function getCustomerSession() {
  for (const storage of storageList()) {
    try {
      const saved = storage.getItem(CUSTOMER_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      storage.removeItem(CUSTOMER_SESSION_KEY);
    }
  }
  return null;
}

export function saveCustomerSession(session, { remember = false } = {}) {
  const payload = JSON.stringify(session);
  window.sessionStorage.setItem(CUSTOMER_SESSION_KEY, payload);

  if (remember) {
    window.localStorage.setItem(CUSTOMER_SESSION_KEY, payload);
    window.localStorage.setItem(CUSTOMER_REMEMBER_KEY, 'true');
  } else {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    window.localStorage.removeItem(CUSTOMER_REMEMBER_KEY);
  }
}

export function updateCustomerSession(patch) {
  const current = getCustomerSession();
  if (!current) return null;

  const remember = window.localStorage.getItem(CUSTOMER_REMEMBER_KEY) === 'true';
  const nextSession = { ...current, ...patch };
  saveCustomerSession(nextSession, { remember });
  return nextSession;
}

export function clearCustomerSession() {
  window.sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.localStorage.removeItem(CUSTOMER_REMEMBER_KEY);
}

function getSaudiMobileCore(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00966')) digits = digits.slice(5);
  if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function normalizeCustomerPhone(value) {
  const core = getSaudiMobileCore(value);
  return core.length === 9 ? `0${core}` : String(value || '').replace(/\D/g, '');
}

export function getCustomerPhoneVariants(value) {
  const core = getSaudiMobileCore(value);
  const normalized = normalizeCustomerPhone(value);
  const variants = [normalized, core];

  if (core.length === 9) {
    variants.push(`966${core}`, `+966${core}`, `00966${core}`);
  }

  return [...new Set(variants.filter(Boolean))];
}

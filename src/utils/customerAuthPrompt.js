import { getCustomerSession } from './customerSession';

const CUSTOMER_AUTH_PROMPT_KEY = 'art_moment_customer_auth_prompt_shown';

export function shouldAutoOpenCustomerAuth() {
  if (getCustomerSession()) return false;

  try {
    return window.sessionStorage.getItem(CUSTOMER_AUTH_PROMPT_KEY) !== 'true';
  } catch {
    // The prompt can still be shown when session storage is unavailable.
    return true;
  }
}

export function markCustomerAuthPromptShown() {
  try {
    window.sessionStorage.setItem(CUSTOMER_AUTH_PROMPT_KEY, 'true');
  } catch {
    // Nothing else is required when session storage is unavailable.
  }
}

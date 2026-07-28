import { supabase } from '../lib/supabase';

const ANONYMOUS_ID_KEY = 'art_moment_anonymous_id';
const SESSION_ID_KEY = 'art_moment_store_session_id';

function randomId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getStoreAnonymousId() {
  if (typeof window === 'undefined') return 'server';
  let value = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!value) {
    value = randomId('visitor');
    localStorage.setItem(ANONYMOUS_ID_KEY, value);
  }
  return value;
}

export function getStoreSessionId() {
  if (typeof window === 'undefined') return 'server';
  let value = sessionStorage.getItem(SESSION_ID_KEY);
  if (!value) {
    value = randomId('session');
    sessionStorage.setItem(SESSION_ID_KEY, value);
  }
  return value;
}

export function trackStoreEvent(eventName, metadata = {}) {
  if (typeof window === 'undefined') return;

  void supabase.rpc('track_store_funnel_event', {
    p_event_name: eventName,
    p_anonymous_id: getStoreAnonymousId(),
    p_session_id: getStoreSessionId(),
    p_path: window.location.pathname,
    p_metadata: metadata,
  }).then(({ error }) => {
    if (error && !/track_store_funnel_event|schema cache|does not exist/i.test(error.message || '')) {
      console.warn('Store analytics event failed:', error.message);
    }
  });
}

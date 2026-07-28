import { supabase } from '../lib/supabase';
import { getStoreAnonymousId } from './storeAnalytics';

const sentFingerprints = new Map();

function fingerprint(message, source) {
  const value = `${source || ''}:${message || ''}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return `web_${Math.abs(hash)}`;
}

export function reportClientError(error, metadata = {}) {
  if (typeof window === 'undefined') return;
  const message = String(error?.message || error || 'unknown_client_error').slice(0, 1000);
  const stack = String(error?.stack || '').slice(0, 8000);
  const source = String(metadata.source || 'web');
  const key = fingerprint(message, source);
  const lastSentAt = sentFingerprints.get(key) || 0;
  if (Date.now() - lastSentAt < 60_000) return;
  sentFingerprints.set(key, Date.now());

  void supabase.rpc('log_client_error', {
    p_fingerprint: key,
    p_message: message,
    p_stack: stack,
    p_path: window.location.pathname,
    p_anonymous_id: getStoreAnonymousId(),
    p_metadata: {
      source,
      userAgent: navigator.userAgent.slice(0, 300),
      ...metadata,
    },
  });
}

export function installGlobalErrorMonitoring() {
  if (typeof window === 'undefined' || window.__artMomentErrorMonitoringInstalled) return;
  window.__artMomentErrorMonitoringInstalled = true;

  window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message, {
      source: 'window_error',
      file: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, { source: 'unhandled_rejection' });
  });
}


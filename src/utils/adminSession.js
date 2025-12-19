// src/utils/adminSession.js
// جلسة لوحة التحكم (LocalStorage) — نسخة V1 بدون Backend

const KEY = 'artMoment_admin_session';

// افتراضي: 7 أيام
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  const s = safeJsonParse(raw, null);
  if (!s || typeof s !== 'object') return null;
  if (typeof s.expiresAt !== 'number') return null;
  return s;
}

export function touchAdminSession(ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === 'undefined') return;
  const expiresAt = nowMs() + (Number(ttlMs) || DEFAULT_TTL_MS);
  window.localStorage.setItem(KEY, JSON.stringify({ expiresAt }));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

export function getAdminSessionExpiresAt() {
  const s = readSession();
  return s?.expiresAt ?? null;
}

export function isAdminSessionActive() {
  const s = readSession();
  if (!s) return false;
  if (nowMs() > s.expiresAt) {
    clearAdminSession();
    return false;
  }
  return true;
}

// توافق مع أسماء قديمة
export const isAdminSessionValid = isAdminSessionActive;

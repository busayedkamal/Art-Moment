// src/utils/adminSession.js
// جلسة لوحة التحكم (LocalStorage) — V1 بدون أي API

export const ADMIN_SESSION_KEY = 'artMoment_admin_session';

// مدة الخمول قبل انتهاء الجلسة (بالدقائق)
export const MAX_INACTIVE_MINUTES = 60;

function nowMs() {
  return Date.now();
}

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getAdminSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  return safeParse(raw, null);
}

export function startAdminSession() {
  if (typeof window === 'undefined') return;
  const t = nowMs();
  const expiresAt = t + MAX_INACTIVE_MINUTES * 60 * 1000;

  window.localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      lastActiveAt: t,
      expiresAt,
    })
  );
}

export function touchAdminSession() {
  // تمديد الجلسة مع كل تفاعل
  if (typeof window === 'undefined') return;

  const s = getAdminSession();
  const t = nowMs();

  // إذا ما في جلسة، لا نسوي شيء
  if (!s) return;

  const expiresAt = t + MAX_INACTIVE_MINUTES * 60 * 1000;

  window.localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      ...s,
      lastActiveAt: t,
      expiresAt,
    })
  );
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

// اسم قديم/بديل (لو عندك ملفات تستدعيه)
export function endAdminSession() {
  clearAdminSession();
}

// تحقق أساسي: الجلسة موجودة + غير منتهية
export function isAdminSessionValid() {
  if (typeof window === 'undefined') return false;
  const s = getAdminSession();
  if (!s || !s.expiresAt) return false;
  return nowMs() < Number(s.expiresAt);
}

// Alias لتوافق أي استيرادات قديمة
export function isAdminSessionActive() {
  return isAdminSessionValid();
}

// (اختياري) Default export لو بعض الملفات تفضله
export default {
  ADMIN_SESSION_KEY,
  MAX_INACTIVE_MINUTES,
  getAdminSession,
  startAdminSession,
  touchAdminSession,
  clearAdminSession,
  endAdminSession,
  isAdminSessionValid,
  isAdminSessionActive,
};

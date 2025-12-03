// src/utils/adminSession.js

// مفتاح التخزين في LocalStorage
export const SESSION_KEY = 'artMoment_admin_session'

// أقصى مدة خمول بالدقائق قبل انتهاء جلسة المسؤول
export const MAX_INACTIVE_MINUTES = 30

const now = () => Date.now()

// تفعيل جلسة المسؤول وتحديد وقت انتهاء لها
export function markAdminSessionActive() {
  const expiresAt = now() + MAX_INACTIVE_MINUTES * 60 * 1000
  const payload = { expiresAt }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // لو المتصفح منع التخزين نتجاهل الخطأ
  }
}

// أسماء أخرى لنفس الوظيفة (توافق مع باقي الملفات)
export function startAdminSession() {
  markAdminSessionActive()
}
export const setAdminSessionActive = markAdminSessionActive

// مسح جلسة المسؤول (تسجيل خروج)
export function clearAdminSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // نتجاهل الأخطاء
  }
}

// التحقق هل جلسة المسؤول ما زالت فعّالة أم انتهت
export function isAdminSessionActive() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false

    const data = JSON.parse(raw)
    if (!data || typeof data.expiresAt !== 'number') {
      localStorage.removeItem(SESSION_KEY)
      return false
    }

    // انتهت الجلسة؟
    if (now() > data.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return false
    }

    return true
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return false
  }
}

// اسم بديل مستخدم في بعض الملفات
export function isAdminSessionValid() {
  return isAdminSessionActive()
}

// تمديد الجلسة لو كانت ما زالت فعّالة
export function refreshAdminSession() {
  if (isAdminSessionActive()) {
    markAdminSessionActive()
  }
}

// ✅ هذه هي الدالة المطلوبة في Layout.jsx
// نفس فكرة refreshAdminSession بالضبط
export function touchAdminSession() {
  refreshAdminSession()
}

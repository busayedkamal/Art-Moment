// src/storage/settingsStorage.js
// إعدادات المشروع (LocalStorage) — نسخة V1

const SETTINGS_KEY = 'art-moment-settings';

export const DEFAULT_SETTINGS = {
  brandName: 'Art-Moment',
  whatsapp: '',
  adminPin: '1234',

  currency: 'ر.س',
  invoiceTitle: 'فاتورة',
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
};

function safeParse(raw, fallback) {
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  const parsed = safeParse(raw, {});
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export function saveSettings(next) {
  if (typeof window === 'undefined') return;
  const merged = { ...DEFAULT_SETTINGS, ...(next || {}) };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

export function updateSettings(partial) {
  const current = loadSettings();
  const merged = { ...current, ...(partial || {}) };
  saveSettings(merged);
  return merged;
}

export function resetSettings() {
  saveSettings({ ...DEFAULT_SETTINGS });
  return loadSettings();
}

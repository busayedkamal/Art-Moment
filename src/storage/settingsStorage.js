// src/storage/settingsStorage.js

const SETTINGS_KEY = 'artMomentSettings'

// القوالب الافتراضية للملاحظات السريعة
const DEFAULT_NOTE_TEMPLATES = [
  'تم استلام العربون.',
  'بانتظار صور إضافية من العميل.',
  'جاهز للاستلام – تم التواصل مع العميل.',
  'تم التسليم – بانتظار تقييمك لنا 🌟.',
]

// إعدادات افتراضية
const DEFAULT_SETTINGS = {
  price4x6: 0,
  priceA4: 0,
  noteTemplates: DEFAULT_NOTE_TEMPLATES,
}

export function loadSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed = JSON.parse(raw) || {}

    // ندمج الافتراضي مع المخزَّن حتى لا نخسر أي قيمة جديدة
    const merged = {
      ...DEFAULT_SETTINGS,
      ...parsed,
    }

    // تأكد أن noteTemplates مصفوفة صحيحة
    if (
      !Array.isArray(merged.noteTemplates) ||
      merged.noteTemplates.length === 0
    ) {
      merged.noteTemplates = DEFAULT_NOTE_TEMPLATES
    }

    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(partial) {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }

  const current = loadSettings()
  const next = {
    ...current,
    ...partial,
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // تجاهل أخطاء التخزين
  }

  return next
}

// للتصدير في أماكن أخرى إذا حبّينا نرجع الافتراضي
export { DEFAULT_NOTE_TEMPLATES }

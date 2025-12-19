// src/utils/statusHelpers.js
// مساعدات عامة للتواريخ + تسميات الحالات (V1 بدون أي مكتبات خارجية)

function toDateAtLocalEndOfDay(dateStr) {
  // يتعامل مع:
  // - "YYYY-MM-DD"
  // - ISO مثل "2025-12-15T10:20:30Z"
  if (!dateStr) return null

  const s = String(dateStr).trim()
  if (!s) return null

  // لو كان تاريخ فقط YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    // نهاية اليوم محليًا (أكثر منطقية للاستحقاق)
    return new Date(y, mo, d, 23, 59, 59, 999)
  }

  // ISO أو أي صيغة أخرى
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = toDateAtLocalEndOfDay(dateStr)
  if (!d) return String(dateStr)

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isOrderLate(order) {
  if (!order?.dueDate) return false

  const due = toDateAtLocalEndOfDay(order.dueDate)
  if (!due) return false

  const status = String(order.status || '').trim()

  // حالات تعتبر "مقفلة" (لا نحسبها متأخرة)
  const closedStatuses = new Set([
    'تم التسليم',
    'ملغي',
    'delivered',
    'cancelled',
    'canceled',
  ])

  if (closedStatuses.has(status)) return false

  const now = new Date()
  return due.getTime() < now.getTime()
}

export function getStatusLabel(status) {
  if (!status) return 'غير محدد'
  const s = String(status).trim()

  // لو كانت عربية أصلًا
  const arabicKnown = new Set(['جديد', 'قيد الطباعة', 'جاهز', 'تم التسليم', 'ملغي'])
  if (arabicKnown.has(s)) return s

  // أكواد/قيم قديمة محتملة
  const map = {
    new: 'جديد',
    in_progress: 'قيد الطباعة',
    printing: 'قيد الطباعة',
    ready: 'جاهز',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
    canceled: 'ملغي',
  }

  return map[s] || s
}

export function getPaymentStatusLabel(status) {
  if (!status) return 'غير مدفوع'
  const s = String(status).trim()

  // لو كانت عربية أصلًا
  const arabicKnown = new Set(['غير مدفوع', 'مدفوع جزئياً', 'مدفوع بالكامل'])
  if (arabicKnown.has(s)) return s

  const map = {
    unpaid: 'غير مدفوع',
    partial: 'مدفوع جزئياً',
    paid: 'مدفوع بالكامل',
  }

  return map[s] || s
}

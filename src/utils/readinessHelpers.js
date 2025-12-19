// src/utils/readinessHelpers.js

// تحويل رقم بأمان
function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// قراءة تاريخ YYYY-MM-DD كـ "تاريخ فقط" بدون تأثير التوقيت
function parseDateOnly(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  // نتوقع غالبًا YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    const dt = new Date(y, mo, d) // local date-only
    if (Number.isNaN(dt.getTime())) return null
    return dt
  }

  // fallback لو جاء بصيغة مختلفة
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return null
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

function getTodayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * ترجع كائن جاهزية مبني على بيانات الطلب:
 * {
 *   code: string,
 *   label: string,
 *   tone: 'success' | 'warning' | 'danger' | 'muted'
 * }
 */
export function getReadinessInfo(order) {
  if (!order) {
    return { code: 'none', label: 'غير معروف', tone: 'muted' }
  }

  const status = order.status || ''

  // الحالات النهائية أولاً
  if (status === 'تم التسليم') {
    return { code: 'delivered', label: 'تم التسليم', tone: 'muted' }
  }
  if (status === 'ملغي') {
    return { code: 'cancelled', label: 'ملغي', tone: 'muted' }
  }

  // صور
  const photos4x6 = toNumber(order.photos4x6, 0)
  const photosA4 = toNumber(order.photosA4, 0)
  const photosCount = photos4x6 + photosA4
  const hasPhotos = photosCount > 0

  // مبالغ (ملاحظة: totalAmount = 0 لا يعني نقص بيانات)
  const totalAmount = toNumber(order.totalAmount, 0)
  const paidAmount = toNumber(order.paidAmount, 0)

  const hasAmountField =
    order.totalAmount !== undefined &&
    order.totalAmount !== null &&
    String(order.totalAmount) !== ''

  // الدفع
  const nothingToPay = hasAmountField && totalAmount <= 0
  const isPaidFully = nothingToPay || (hasAmountField && paidAmount >= totalAmount - 0.0001)
  const isPartiallyPaid =
    hasAmountField && totalAmount > 0 && paidAmount > 0 && paidAmount < totalAmount - 0.0001
  const isUnpaid = hasAmountField && totalAmount > 0 && paidAmount <= 0

  // تاريخ التسليم
  const due = parseDateOnly(order.dueDate)
  const hasValidDueDate = !!due
  const today = getTodayDateOnly()
  const isLate = hasValidDueDate ? due < today : false

  // متأخر عن الموعد
  if (isLate) {
    return { code: 'late', label: 'متأخر عن الموعد', tone: 'danger' }
  }

  // لو الطلب "جاهز"
  if (status === 'جاهز') {
    if (!hasPhotos) {
      return { code: 'ready_missing_photos', label: 'جاهز لكن بيانات الصور ناقصة', tone: 'warning' }
    }
    if (!hasAmountField) {
      return { code: 'ready_missing_amount', label: 'جاهز لكن المبلغ غير محدد', tone: 'warning' }
    }
    if (isPaidFully) {
      return { code: 'ready_for_pickup', label: 'جاهز للتسليم', tone: 'success' }
    }
    return { code: 'ready_unpaid', label: 'جاهز لكن غير مدفوع بالكامل', tone: 'warning' }
  }

  // لو الطلب "قيد الطباعة"
  if (status === 'قيد الطباعة') {
    if (!hasPhotos) {
      return { code: 'in_progress_missing_photos', label: 'قيد التنفيذ (بانتظار الصور)', tone: 'warning' }
    }
    if (!hasAmountField) {
      return { code: 'in_progress_missing_amount', label: 'قيد التنفيذ (المبلغ غير محدد)', tone: 'warning' }
    }
    if (isPartiallyPaid) {
      return { code: 'in_progress_partial_paid', label: 'قيد التنفيذ (مدفوع جزئياً)', tone: 'warning' }
    }
    if (isUnpaid) {
      return { code: 'in_progress_unpaid', label: 'قيد التنفيذ (غير مدفوع)', tone: 'warning' }
    }
    return { code: 'in_progress', label: 'قيد التنفيذ', tone: 'warning' }
  }

  // لو الطلب "جديد" (أو أي حالة أخرى)
  if (!hasPhotos) {
    return { code: 'waiting_photos', label: 'بانتظار تحديد الصور', tone: 'muted' }
  }

  // نعتبر تاريخ التسليم مهم للتخطيط لكن ليس شرطًا يمنع الجاهزية دائمًا
  if (!hasValidDueDate) {
    return { code: 'missing_due_date', label: 'بانتظار تحديد تاريخ التسليم', tone: 'muted' }
  }

  if (!hasAmountField) {
    return { code: 'missing_amount', label: 'بانتظار تحديد المبلغ', tone: 'muted' }
  }

  if (isPartiallyPaid) {
    return { code: 'waiting_payment', label: 'بانتظار استكمال الدفع', tone: 'warning' }
  }

  return { code: 'normal', label: 'قيد المتابعة', tone: 'muted' }
}

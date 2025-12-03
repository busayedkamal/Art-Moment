// src/utils/readinessHelpers.js

// دالة ترجع كائن جاهزية مبني على بيانات الطلب
export function getReadinessInfo(order) {
  if (!order) {
    return {
      code: 'none',
      label: 'غير معروف',
      tone: 'muted',
    }
  }

  const photosCount =
    Number(order.photos4x6 || 0) + Number(order.photosA4 || 0)
  const hasPhotos = photosCount > 0

  const totalAmount = Number(order.totalAmount || 0)
  const paidAmount = Number(order.paidAmount || 0)
  const hasPricing = totalAmount > 0

  const isPaid = hasPricing && paidAmount >= totalAmount - 0.0001
  const isPartiallyPaid =
    hasPricing && paidAmount > 0 && paidAmount < totalAmount

  const hasDueDate = !!order.dueDate

  const today = new Date()
  let isLate = false
  if (hasDueDate) {
    const d = new Date(order.dueDate)
    if (!Number.isNaN(d.getTime())) {
      const todayDateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      )
      const dueDateOnly = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      )
      isLate = dueDateOnly < todayDateOnly
    }
  }

  const status = order.status

  // الحالات النهائية أولاً
  if (status === 'تم التسليم') {
    return { code: 'delivered', label: 'تم التسليم', tone: 'muted' }
  }
  if (status === 'ملغي') {
    return { code: 'cancelled', label: 'ملغي', tone: 'muted' }
  }

  // متأخر عن الموعد
  if (isLate) {
    return { code: 'late', label: 'متأخر عن الموعد', tone: 'danger' }
  }

  // جاهز ومدفوع بالكامل
  if (hasPhotos && hasPricing && isPaid && status === 'جاهز') {
    return {
      code: 'ready_for_pickup',
      label: 'جاهز للتسليم (مدفوع)',
      tone: 'success',
    }
  }

  // جاهز لكن غير مدفوع بالكامل
  if (hasPhotos && status === 'جاهز') {
    return {
      code: 'ready_unpaid',
      label: 'جاهز لكن غير مدفوع بالكامل',
      tone: 'warning',
    }
  }

  // قيد التنفيذ
  if (hasPhotos && status === 'قيد الطباعة') {
    return { code: 'in_progress', label: 'قيد التنفيذ', tone: 'warning' }
  }

  // بيانات ناقصة (صور/سعر/تاريخ)
  if (!hasPhotos || !hasPricing || !hasDueDate) {
    return {
      code: 'missing_data',
      label: 'بيانات الطلب غير مكتملة',
      tone: 'muted',
    }
  }

  // بانتظار استكمال الدفع
  if (isPartiallyPaid) {
    return {
      code: 'waiting_payment',
      label: 'بانتظار استكمال الدفع',
      tone: 'warning',
    }
  }

  // وضع عادي
  return {
    code: 'normal',
    label: 'قيد المتابعة',
    tone: 'muted',
  }
}

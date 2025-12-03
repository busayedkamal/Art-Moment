// src/utils/statusHelpers.js
import { format, parseISO, isBefore } from 'date-fns'

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd')
  } catch {
    return dateStr
  }
}

export function isOrderLate(order) {
  if (!order.dueDate) return false
  try {
    const due = parseISO(order.dueDate)
    const today = new Date()
    return isBefore(due, today) &&
      order.status !== 'delivered' &&
      order.status !== 'cancelled'
  } catch {
    return false
  }
}

export function getStatusLabel(status) {
  const map = {
    new: 'جديد',
    in_progress: 'قيد الطباعة',
    ready: 'جاهز',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
  }
  return map[status] || status
}

export function getPaymentStatusLabel(status) {
  const map = {
    unpaid: 'غير مدفوع',
    partial: 'مدفوع جزئياً',
    paid: 'مدفوع بالكامل',
  }
  return map[status] || status
}

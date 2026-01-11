// src/components/StatusBadges.jsx
import React from 'react'

function baseBadge() {
  return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
}

export function StatusBadge({ status }) {
  let cls = baseBadge()

  if (status === 'جديد') cls += ' bg-blue-100 text-blue-800'
  else if (status === 'قيد الطباعة') cls += ' bg-amber-100 text-amber-800'
  else if (status === 'جاهز') cls += ' bg-fuchsia-100 text-fuchsia-800'
  else if (status === 'تم التسليم') cls += ' bg-slate-100 text-slate-800'
  else if (status === 'ملغي') cls += ' bg-red-100 text-red-800'
  else cls += ' bg-slate-100 text-slate-800'

  return <span className={cls}>{status || 'غير محدد'}</span>
}

export function PaymentBadge({ paymentStatus }) {
  let cls = baseBadge()

  if (paymentStatus === 'مدفوع بالكامل') cls += ' bg-fuchsia-100 text-fuchsia-800'
  else if (paymentStatus === 'مدفوع جزئياً') cls += ' bg-amber-100 text-amber-800'
  else if (paymentStatus === 'غير مدفوع') cls += ' bg-red-100 text-red-800'
  else cls += ' bg-slate-100 text-slate-800'

  return <span className={cls}>{paymentStatus || 'غير محدد'}</span>
}

// اختياري: لو تبغى تستخدمها بدل الدالة داخل OrderDetails
export function ReadinessBadge({ label, tone }) {
  let cls = baseBadge() + ' border '

  if (tone === 'success') cls += ' bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100'
  else if (tone === 'danger') cls += ' bg-red-50 text-red-700 border-red-100'
  else if (tone === 'warning') cls += ' bg-amber-50 text-amber-800 border-amber-100'
  else cls += ' bg-slate-50 text-slate-700 border-slate-200'

  return <span className={cls}>{label || 'غير محدد'}</span>
}

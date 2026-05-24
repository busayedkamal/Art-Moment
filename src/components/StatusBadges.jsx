// src/components/StatusBadges.jsx
// ألوان الشارات متوافقة مع هوية لحظة فن
import React from 'react'

function baseBadge() {
  return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold'
}

export function StatusBadge({ status }) {
  let cls = baseBadge()

  if      (status === 'جديد')        cls += ' bg-blue-100 text-blue-700'
  else if (status === 'قيد الطباعة') cls += ' bg-amber-100 text-amber-700'
  else if (status === 'جاهز')        cls += ' bg-[#D9A3AA]/20 text-[#C48A92]'   // وردي هوية لحظة فن
  else if (status === 'تم التسليم') cls += ' bg-emerald-100 text-emerald-700'
  else if (status === 'ملغي')        cls += ' bg-red-100 text-red-700'
  else                               cls += ' bg-[#4A4A4A]/10 text-[#4A4A4A]/60'

  return <span className={cls}>{status || 'غير محدد'}</span>
}

export function PaymentBadge({ paymentStatus }) {
  let cls = baseBadge()

  if      (paymentStatus === 'مدفوع بالكامل') cls += ' bg-[#D9A3AA]/20 text-[#C48A92]'  // وردي
  else if (paymentStatus === 'مدفوع جزئياً')  cls += ' bg-amber-100 text-amber-700'
  else if (paymentStatus === 'غير مدفوع')     cls += ' bg-red-100 text-red-700'
  else                                         cls += ' bg-[#4A4A4A]/10 text-[#4A4A4A]/60'

  return <span className={cls}>{paymentStatus || 'غير محدد'}</span>
}

export function ReadinessBadge({ label, tone }) {
  let cls = baseBadge() + ' border '

  if      (tone === 'success') cls += ' bg-[#D9A3AA]/10 text-[#C48A92] border-[#D9A3AA]/30'  // وردي
  else if (tone === 'danger')  cls += ' bg-red-50 text-red-700 border-red-100'
  else if (tone === 'warning') cls += ' bg-amber-50 text-amber-700 border-amber-100'
  else                         cls += ' bg-[#F8F5F2] text-[#4A4A4A]/60 border-[#4A4A4A]/15'

  return <span className={cls}>{label || 'غير محدد'}</span>
}

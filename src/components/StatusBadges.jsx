// src/components/StatusBadges.jsx
// مكوّنات صغيرة لإظهار البادجات (الحالة + الدفع)
// الألوان كلها مبنية على هوية لحظة فن: Emerald + Slate

const baseBadge =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] md:text-xs font-medium border'

export function StatusBadge({ status }) {
  let classes = ''
  let label = status || 'غير محدد'

  switch (status) {
    case 'جديد':
      // أخضر فاتح كبداية الطلب
      classes = ' bg-emerald-50 text-emerald-700 border-emerald-100'
      break
    case 'قيد الطباعة':
      // لون تحذيري لطيف أثناء التنفيذ
      classes = ' bg-amber-50 text-amber-700 border-amber-100'
      break
    case 'جاهز':
      // أخضر أوضح
      classes = ' bg-emerald-100 text-emerald-800 border-emerald-200'
      break
    case 'تم التسليم':
      // لون حيادي يدل على الإغلاق
      classes = ' bg-slate-100 text-slate-700 border-slate-200'
      break
    case 'ملغي':
      classes = ' bg-red-50 text-red-700 border-red-100'
      break
    default:
      classes = ' bg-slate-50 text-slate-700 border-slate-100'
      break
  }

  return <span className={baseBadge + classes}>{label}</span>
}

export function PaymentBadge({ paymentStatus }) {
  let classes = ''
  let label = paymentStatus || 'غير محدد'

  switch (paymentStatus) {
    case 'مدفوع بالكامل':
      classes = ' bg-emerald-50 text-emerald-700 border-emerald-100'
      break
    case 'مدفوع جزئياً':
      classes = ' bg-amber-50 text-amber-700 border-amber-100'
      break
    case 'غير مدفوع':
      classes = ' bg-red-50 text-red-700 border-red-100'
      break
    default:
      classes = ' bg-slate-50 text-slate-700 border-slate-100'
      break
  }

  return <span className={baseBadge + classes}>{label}</span>
}

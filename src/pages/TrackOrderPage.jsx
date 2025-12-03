// src/pages/TrackOrderPage.jsx
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { loadOrders } from '../storage/orderStorage.js'
import {
  StatusBadge,
  PaymentBadge,
} from '../components/StatusBadges.jsx'

// استيراد الشعار من مجلد assets
import logoArtMoment from '../assets/logo-art-moment.svg'

const WHATSAPP_NUMBER = '966569663697'

// دالة لتطبيع رقم الجوال بشكل مرن لكن دقيق
// أمثلة مدعومة:
// 05xxxxxxxx  → 5xxxxxxxx
// 5xxxxxxxxx  → 5xxxxxxxx
// +9665xxxxxxx / 009665xxxxxxx / 9665xxxxxxx → 5xxxxxxxx
function normalizePhone(value) {
  const digitsOnly = String(value || '').replace(/\D/g, '') // إزالة أي شيء غير رقم
  if (!digitsOnly) return ''

  let d = digitsOnly

  // إزالة 00 في البداية (مثل 00966)
  if (d.startsWith('00')) {
    d = d.slice(2)
  }

  // إزالة كود السعودية 966 إن وجد
  if (d.startsWith('966')) {
    d = d.slice(3)
  }

  // لو يبدأ بـ 05 نحذف الصفر ونبقي 5xxxxxxxx
  if (d.startsWith('05')) {
    d = d.slice(1)
  }

  // لو بقي يبدأ بـ 5 وطوله أكبر من 9، نأخذ آخر 9 أرقام
  if (d.startsWith('5') && d.length > 9) {
    d = d.slice(-9)
  }

  // في النهاية نتوقع رقم جوال 9 أرقام يبدأ بـ 5
  return d
}

export default function TrackOrderPage() {
  const [phone, setPhone] = useState('')
  const [orderId, setOrderId] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const orders = loadOrders() || []

  const results = useMemo(() => {
    const phoneTermRaw = phone.trim()
    const idTermRaw = orderId.trim()

    const phoneTerm = normalizePhone(phoneTermRaw)
    const idTerm = idTermRaw.toLowerCase()

    // لو ما في ولا واحد منهم → لا نتائج
    if (!phoneTerm && !idTerm) return []

    let list = orders

    // 1) مطابقة رقم الطلب تطابق كامل (ليس contains)
    if (idTerm) {
      list = list.filter(
        (o) =>
          String(o.id || '')
            .toLowerCase()
            .trim() === idTerm,
      )
    }

    // 2) مطابقة رقم الجوال تطابق كامل بعد التطبيع
    if (phoneTerm) {
      list = list.filter((o) => {
        const normOrderPhone = normalizePhone(o.phone)
        return normOrderPhone && normOrderPhone === phoneTerm
      })
    }

    // ترتيب من الأحدث إلى الأقدم حسب تاريخ الإنشاء
    return [...list].sort((a, b) =>
      String(b.createdAt || '').localeCompare(
        String(a.createdAt || ''),
      ),
    )
  }, [orders, phone, orderId])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const hasInput = phone.trim() || orderId.trim()

  const waMessage = `السلام عليكم، لم أستطع العثور على طلبي في صفحة التتبع.
رقم الجوال: ${phone || '-'}
رقم الطلب: ${orderId || '-'}`
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    waMessage,
  )}`

  return (
    <div className="max-w-3xl mx-auto px-3 py-6 md:py-10 space-y-6">
      {/* الهيدر: شعار + رجوع للموقع */}
      <header className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <img
            src={logoArtMoment}
            alt="لحظة فن"
            className="w-10 h-10 rounded-xl object-cover border border-emerald-100 shadow-sm"
          />
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-900">
              لحظة فن – تتبّع طلبك
            </h1>
            <p className="text-[11px] md:text-xs text-slate-500">
              تابع حالة طلب طباعة الصور الخاصة بك بسهولة وأمان.
            </p>
          </div>
        </div>

        <Link to="/" className="btn-ghost">
          ← الرجوع للصفحة الرئيسية
        </Link>
      </header>

      {/* كرت الفورم */}
      <div className="card space-y-4 text-sm">
        <div>
          <h2 className="font-semibold text-slate-900 text-sm md:text-base mb-1">
            أدخل بياناتك لتتبع الطلب
          </h2>
          <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
            يمكنك البحث باستخدام{' '}
            <span className="font-semibold text-slate-800">
              رقم الجوال أو رقم الطلب أو كليهما
            </span>
            . يتم عرض الطلبات التي{' '}
            <span className="font-semibold text-slate-800">
              تطابق البيانات بشكل كامل
            </span>{' '}
            للحفاظ على خصوصيتك.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 text-slate-600">
                رقم الجوال
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 05xxxxxxxx"
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-slate-600">
                رقم الطلب
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="مثل الرقم الذي وصلك في الواتساب"
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-slate-500">
              * يجب كتابة رقم الجوال/رقم الطلب بنفس الصيغة التي تم تسجيلها
              في الطلب، ويتم البحث بالمطابقة الكاملة بعد توحيد الصيغة.
            </p>
            <button type="submit" className="btn-primary">
              بحث عن الطلب
            </button>
          </div>
        </form>
      </div>

      {/* كرت النتائج + FAQ + واتساب */}
      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold text-slate-900 text-sm md:text-base">
          نتيجة البحث
        </h2>

        {!submitted || !hasInput ? (
          <p className="text-xs md:text-sm text-slate-500">
            اكتب رقم الجوال أو رقم الطلب في الأعلى واضغط على زر{' '}
            <span className="font-semibold">بحث عن الطلب</span> لعرض
            تفاصيل حالته.
          </p>
        ) : results.length === 0 ? (
          <>
            <p className="text-xs md:text-sm text-red-600">
              لم يتم العثور على أي طلب يطابق البيانات المدخلة.
            </p>
            <p className="text-[11px] text-slate-500">
              تأكد من كتابة رقم الجوال أو رقم الطلب بشكل كامل وصحيح. إذا
              استمرت المشكلة يمكنك التواصل معنا عبر الواتساب.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs md:text-sm text-slate-600">
              تم العثور على{' '}
              <span className="font-semibold text-slate-900">
                {results.length}
              </span>{' '}
              طلب/طلبات مطابقة تماماً للبيانات المدخلة.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-right">رقم الطلب</th>
                    <th className="text-right">الحالة</th>
                    <th className="text-right">الدفع</th>
                    <th className="text-right">المبلغ</th>
                    <th className="text-right">المدفوع</th>
                    <th className="text-right">تاريخ الإنشاء</th>
                    <th className="text-right">تاريخ التسليم</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 font-mono text-[11px]">
                        {o.id}
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>
                        <PaymentBadge
                          paymentStatus={o.paymentStatus}
                        />
                      </td>
                      <td className="text-xs text-slate-800">
                        {(o.totalAmount || 0).toFixed(2)} ر.س
                      </td>
                      <td className="text-xs text-slate-800">
                        {(o.paidAmount || 0).toFixed(2)} ر.س
                      </td>
                      <td className="text-xs text-slate-500">
                        {o.createdAt || '-'}
                      </td>
                      <td className="text-xs text-slate-500">
                        {o.dueDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* فقرة أسئلة شائعة: متى يتم تحديث حالة الطلب؟ */}
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <h3 className="text-[11px] font-semibold text-slate-800 mb-1">
            متى يتم تحديث حالة الطلب؟
          </h3>
          <ul className="list-disc pr-4 space-y-0.5 text-[11px] text-slate-600">
            <li>
              <span className="font-semibold">جديد:</span> بعد تسجيل
              الطلب من قبل مسؤول لحظة فن.
            </li>
            <li>
              <span className="font-semibold">قيد الطباعة:</span> عند
              بدء تجهيز وطباعة الصور في المختبر.
            </li>
            <li>
              <span className="font-semibold">جاهز:</span> عند الانتهاء
              من الطباعة والتغليف وجاهزيته للاستلام أو التسليم.
            </li>
            <li>
              <span className="font-semibold">تم التسليم:</span> بعد
              استلامك للطلب أو تسليمه لك.
            </li>
          </ul>
          <p className="mt-1 text-[11px] text-slate-500">
            في حال شعرت أن حالة الطلب لم تُحدَّث، يمكنك مراسلتنا عبر
            الواتساب للتأكد من آخر المستجدات.
          </p>
        </div>

        {/* زر واتساب صغير أسفل الكرت */}
        <div className="pt-2 border-t border-slate-100 mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            إذا لم يظهر طلبك هنا يمكنك مراسلتنا مباشرة.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium bg-emerald-500 text-white hover:bg-emerald-600"
          >
            تواصل عبر الواتساب
          </a>
        </div>
      </div>
    </div>
  )
}

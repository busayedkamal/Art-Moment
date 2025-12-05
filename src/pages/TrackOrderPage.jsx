// src/pages/TrackOrderPage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo-art-moment.svg'

// عدّل هذا الرابط لرقم الواتساب الصحيح المستخدم في المشروع
const WHATSAPP_NUMBER = '9665XXXXXXXX' // مثال: 9665XXXXXXXX

/* ========== دوال التطبيع ========== */

// تحويل أرقام عربية إلى إنجليزية
function toEnglishDigits(str) {
  if (!str) return ''
  const map = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  }
  return str.replace(/[٠-٩]/g, (d) => map[d] ?? d)
}

// تطبيع رقم الجوال لصيغة موحدة 05xxxxxxxx
function normalizePhone(input) {
  if (!input) return ''
  let digits = toEnglishDigits(input)
  digits = digits.replace(/\D/g, '') // إزالة أي شيء غير الأرقام

  if (!digits) return ''

  // إزالة 00966 أو 966 إن وجدت
  if (digits.startsWith('00966')) {
    digits = digits.slice(5)
  } else if (digits.startsWith('966')) {
    digits = digits.slice(3)
  }

  // لو بدأ بـ "5" فقط وعددها 9 أرقام نضيف 0 في البداية
  if (digits.length === 9 && digits.startsWith('5')) {
    digits = '0' + digits
  }

  // الآن نتوقع 10 أرقام تبدأ بـ 05
  if (digits.length === 10 && digits.startsWith('05')) {
    return digits
  }

  // أي شكل آخر يرجع كما هو (حتى يفشل في التحقق لاحقاً)
  return digits
}

function isValidPhoneNormalized(p) {
  return /^05\d{8}$/.test(p)
}

function normalizeOrderId(input) {
  if (!input) return ''
  let v = toEnglishDigits(input).trim().toUpperCase()
  v = v.replace(/\s+/g, '')
  return v
}

/* ========== مكوّنات البادجات ========== */

function StatusPill({ status }) {
  let classes =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium '

  if (status === 'جديد') {
    classes += 'bg-blue-50 text-blue-700 border border-blue-100'
  } else if (status === 'قيد الطباعة') {
    classes += 'bg-amber-50 text-amber-800 border border-amber-100'
  } else if (status === 'جاهز') {
    classes += 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  } else if (status === 'تم التسليم') {
    classes += 'bg-slate-100 text-slate-700 border border-slate-200'
  } else if (status === 'ملغي') {
    classes += 'bg-red-50 text-red-700 border border-red-100'
  } else {
    classes += 'bg-slate-50 text-slate-700 border border-slate-200'
  }

  return <span className={classes}>{status || 'غير محدد'}</span>
}

function PaymentPill({ paymentStatus }) {
  let classes =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium '

  if (paymentStatus === 'مدفوع بالكامل') {
    classes += 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  } else if (paymentStatus === 'مدفوع جزئياً') {
    classes += 'bg-amber-50 text-amber-800 border border-amber-100'
  } else if (paymentStatus === 'غير مدفوع') {
    classes += 'bg-red-50 text-red-700 border border-red-100'
  } else {
    classes += 'bg-slate-50 text-slate-700 border border-slate-200'
  }

  return (
    <span className={classes}>
      {paymentStatus || 'حالة الدفع غير محددة'}
    </span>
  )
}

/* ========== الصفحة الرئيسية لتتبّع الطلب ========== */

export default function TrackOrderPage() {
  const [mode, setMode] = useState('phone') // 'phone' | 'orderId'
  const [phoneInput, setPhoneInput] = useState('')
  const [orderIdInput, setOrderIdInput] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const hasResults = status === 'success' && results.length > 0

  const whatsappLink =
    'https://wa.me/' +
    WHATSAPP_NUMBER +
    '?text=' +
    encodeURIComponent(
      'مرحباً، لم أتمكن من تتبع طلبي عبر صفحة التتبع. أحتاج المساعدة في معرفة حالة الطلب 🙏🏼',
    )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setInfoMessage('')
    setResults([])

    const params = new URLSearchParams()

    if (mode === 'phone') {
      const normalized = normalizePhone(phoneInput)
      if (!isValidPhoneNormalized(normalized)) {
        setErrorMessage(
          'فضلاً أدخل رقم جوال صحيح مكوّن من 10 أرقام يبدأ بـ 05 (نفس الرقم المستخدم عند الطلب).',
        )
        return
      }
      params.set('phone', normalized)
    } else {
      const normalizedId = normalizeOrderId(orderIdInput)
      if (!normalizedId) {
        setErrorMessage(
          'فضلاً أدخل رقم الطلب كما هو مكتوب على الوصل أو في رسالة الواتساب.',
        )
        return
      }
      params.set('id', normalizedId)
    }

    setStatus('loading')

    try {
      const res = await fetch(`/api/orders?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const arr = Array.isArray(data) ? data : data ? [data] : []

      if (!arr.length) {
        setErrorMessage(
          'لم يتم العثور على أي طلب مطابق. تأكد من الرقم المُدخل أو تواصل معنا عبر الواتساب.',
        )
        setStatus('error')
        return
      }

      // ترتيب من الأحدث إلى الأقدم حسب createdAt لو موجود
      arr.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return db - da
      })

      setResults(arr)
      setStatus('success')

      if (mode === 'phone' && arr.length > 1) {
        setInfoMessage(
          'تم العثور على أكثر من طلب لهذا الرقم، نعرض أحدثها أولاً.',
        )
      }
    } catch (err) {
      console.error('فشل جلب الطلبات من API للتتبع:', err)
      setErrorMessage(
        'حدث خطأ أثناء الاتصال بالخادم. جرّب لاحقاً أو تواصل معنا مباشرة عبر الواتساب.',
      )
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* الهيدر العلوي */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logo}
              alt="لحظة فن"
              className="h-8 w-8 rounded-xl object-contain"
            />
            <span className="text-sm font-semibold text-slate-800">
              لحظة فن – تتبّع الطلب
            </span>
          </Link>

          <Link
            to="/"
            className="text-xs md:text-sm px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            ← الرجوع للصفحة الرئيسية
          </Link>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 flex items-center">
        <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12">
          {/* عنوان وتعريف */}
          <div className="mb-6 text-center">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
              تتبّع حالة طلبك بسهولة
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl mx-auto">
              أدخل رقم جوالك أو رقم الطلب كما تم تسجيله وقت إنشاء الطلب، وستظهر
              لك آخر حالة محدثة للطلب وموعد التسليم المتوقع.
            </p>
          </div>

          {/* كرت البحث */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 space-y-4">
            {/* اختيار طريقة التتبع */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-slate-600">طريقة التتبع:</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('phone')
                    setErrorMessage('')
                    setInfoMessage('')
                    setResults([])
                  }}
                  className={
                    'px-3 py-1.5 rounded-lg transition ' +
                    (mode === 'phone'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100')
                  }
                >
                  برقم الجوال
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('orderId')
                    setErrorMessage('')
                    setInfoMessage('')
                    setResults([])
                  }}
                  className={
                    'px-3 py-1.5 rounded-lg transition ' +
                    (mode === 'orderId'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100')
                  }
                >
                  برقم الطلب
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'phone' ? (
                <div>
                  <label className="block text-xs mb-1 text-slate-600">
                    رقم الجوال المستخدم في الطلب
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    className="w-full border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                    placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    نطابق الرقم بعد تحويله لصيغة موحدة (05xxxxxxxx)، لذلك لا
                    مشكلة لو كتبته مع أو بدون +966 أو بأرقام عربية.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs mb-1 text-slate-600">
                    رقم الطلب
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    className="w-full border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                    placeholder="مثال: 20241205-001"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    ستجد رقم الطلب في رسالة الواتساب أو في الوصل المرسل لك من
                    لحظة فن.
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {errorMessage}
                </div>
              )}

              {infoMessage && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {infoMessage}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'جاري البحث…' : 'عرض حالة الطلب'}
                </button>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-[11px] md:text-xs border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                >
                  لم تجد طلبك؟ تواصل عبر واتساب
                </a>
              </div>
            </form>
          </div>

          {/* كرت النتائج + FAQ */}
          <div className="mt-6 space-y-3">
            {status === 'idle' && (
              <p className="text-[11px] md:text-xs text-slate-500 text-center">
                لم يتم البحث بعد. ابدأ بإدخال رقم جوالك أو رقم الطلب، ثم اضغط على
                &quot;عرض حالة الطلب&quot;.
              </p>
            )}

            {status === 'error' && !hasResults && (
              <p className="text-[11px] md:text-xs text-slate-500 text-center">
                إن استمرت المشكلة يمكنك إرسال رقم الطلب ورقم جوالك عبر الواتساب
                وسنخدمك يدويًا.
              </p>
            )}

            {hasResults && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-3">
                <h2 className="text-sm md:text-base font-semibold text-slate-800 mb-1">
                  نتيجة البحث
                </h2>

                {results.map((order) => (
                  <div
                    key={order.id}
                    className="border border-slate-100 rounded-2xl p-3 md:p-4 mb-2 last:mb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="text-[11px] text-slate-500">
                          رقم الطلب
                        </div>
                        <div className="font-mono text-xs md:text-sm">
                          {order.id}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={order.status} />
                        <PaymentPill paymentStatus={order.paymentStatus} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] md:text-xs text-slate-600 mb-2">
                      <div>
                        <span className="text-slate-500">اسم العميل: </span>
                        <span className="font-medium">
                          {order.customerName || 'غير محدد'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">رقم الجوال: </span>
                        <span dir="ltr" className="font-mono">
                          {order.phone || 'غير متوفر'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">
                          تاريخ إنشاء الطلب:{' '}
                        </span>
                        <span>{order.createdAt || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">
                          تاريخ التسليم المطلوب:{' '}
                        </span>
                        <span>{order.dueDate || '-'}</span>
                      </div>
                    </div>

                    <div className="text-[11px] md:text-xs text-slate-600">
                      <div>
                        <span className="text-slate-500">إجمالي المبلغ: </span>
                        <span className="font-semibold">
                          {Number(order.totalAmount || 0).toFixed(2)} ر.س
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">المدفوع: </span>
                        <span className="font-semibold">
                          {Number(order.paidAmount || 0).toFixed(2)} ر.س
                        </span>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mt-2 text-[11px] md:text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                        <div className="font-semibold text-slate-700 mb-0.5">
                          ملاحظة من الاستديو:
                        </div>
                        <div className="whitespace-pre-line">
                          {order.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* FAQ / متى تتحدّث حالة الطلب؟ */}
                <div className="mt-3 border-top border-slate-100 pt-3">
                  <h3 className="text-xs md:text-sm font-semibold text-slate-800 mb-1">
                    متى يتم تحديث حالة الطلب؟
                  </h3>
                  <ul className="list-disc pr-4 text-[11px] md:text-xs text-slate-600 space-y-1">
                    <li>
                      <span className="font-medium">جديد:</span> بعد استلام
                      طلبك وتسجيله في النظام.
                    </li>
                    <li>
                      <span className="font-medium">قيد الطباعة:</span> بعد بدء
                      تجهيز الملف وبدء عملية الطباعة.
                    </li>
                    <li>
                      <span className="font-medium">جاهز للاستلام:</span> بعد
                      الانتهاء من الطباعة وتجهيز الطلب في الاستديو.
                    </li>
                    <li>
                      <span className="font-medium">تم التسليم:</span> بعد
                      استلامك للطلب من المعرض أو عبر خدمة التوصيل.
                    </li>
                  </ul>
                  <p className="mt-2 text-[11px] md:text-xs text-slate-500">
                    إذا شعرت أن حالة الطلب لم تتغيّر منذ فترة، تواصل معنا عبر
                    الواتساب مع ذكر رقم الطلب، وسنراجع الحالة لك مباشرة.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

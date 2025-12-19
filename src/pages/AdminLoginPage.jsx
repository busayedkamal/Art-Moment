// src/pages/AdminLoginPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  isAdminSessionActive,
  startAdminSession,
  MAX_INACTIVE_MINUTES,
} from '../utils/adminSession.js'
import { loadSettings } from '../storage/settingsStorage.js'
import logoImg from '../assets/logo-art-moment.svg'

// تطبيع الرمز: إزالة الفراغات + تحويل الأرقام العربية/الفارسية إلى إنجليزية
function normalizeCode(value) {
  let s = String(value ?? '').trim()
  s = s.replace(/\s+/g, '')

  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  const ar = '٠١٢٣٤٥٦٧٨٩'
  s = s.replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)))

  // Eastern Arabic/Persian ۰۱۲۳۴۵۶۷۸۹
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  s = s.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)))

  return s
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const settings = useMemo(() => {
    try {
      return loadSettings?.() ?? {}
    } catch {
      return {}
    }
  }, [])

  // نفس المفتاح المستخدم في Settings.jsx: adminCode
  const expectedCode = normalizeCode(settings?.adminCode ?? '1234')

  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  // لو الجلسة فعّالة، لا نحتاج صفحة الدخول
  useEffect(() => {
    if (isAdminSessionActive()) {
      navigate('/app', { replace: true })
    }
  }, [navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const entered = normalizeCode(code)

    if (!entered) {
      setError('فضلاً أدخل رمز الدخول.')
      return
    }

    if (entered !== expectedCode) {
      setError('رمز غير صحيح.')
      return
    }

    startAdminSession()

    // لو جاء من صفحة محمية، رجّعه لنفس الوجهة
    const redirectTo = location.state?.from?.pathname || '/app'
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-right">
              <div className="text-slate-500 text-sm">لوحة التحكم</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                لحظة فن — دخول المسؤول
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                سيتم طلب الرمز مجددًا بعد {MAX_INACTIVE_MINUTES} دقيقة خمول.
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden">
              <img
                src={logoImg}
                alt="Art Moment"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-right">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                رمز الدخول للوحة التحكم
              </label>

              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: 1234"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />

              {error ? (
                <div className="mt-2 text-sm text-red-600">{error}</div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">
                  ملاحظة: يقبل أرقام عربية/إنجليزية (مثل ١٢٣٤ أو 1234).
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition"
            >
              دخول للوحة التحكم
            </button>

            <div className="flex items-center justify-between text-sm pt-2">
              <Link to="/" className="text-slate-600 hover:text-slate-900">
                ← الرجوع للصفحة الرئيسية
              </Link>

              <Link to="/track" className="text-emerald-700 hover:text-emerald-900">
                تتبّع طلب
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          * الرمز محفوظ محليًا في إعدادات المتصفح (LocalStorage).
        </p>
      </div>
    </div>
  )
}

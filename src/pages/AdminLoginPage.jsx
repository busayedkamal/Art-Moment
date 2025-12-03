// src/pages/AdminLoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSettings } from '../storage/settingsStorage.js'
import {
  startAdminSession,
  clearAdminSession,
  MAX_INACTIVE_MINUTES,
} from '../utils/adminSession.js'
import logoImg from '../assets/logo-art-moment.svg'

// دالة مساعدة: إزالة الفراغات + تحويل الأرقام العربية إلى إنجليزية
function normalizeCode(value) {
  let str = String(value ?? '')
  // إزالة الفراغات
  str = str.replace(/\s+/g, '')

  // تحويل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) إلى إنجليزية (0123456789)
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  str = str.replace(/[٠-٩]/g, (d) => {
    const idx = arabicDigits.indexOf(d)
    return idx >= 0 ? String(idx) : d
  })

  return str
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  // نقرأ الإعدادات للحصول على رمز الدخول – الافتراضي 1234
  const settings = loadSettings() || {}
  const rawSettingCode =
    settings && typeof settings.adminLoginCode !== 'undefined'
      ? settings.adminLoginCode
      : '1234'

  const expectedCode = normalizeCode(rawSettingCode || '1234')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const settings = loadSettings()
  const expected =
    (settings?.adminCode || settings?.dashboardCode || '1234').trim()

     if (code.trim() !== expected) {
    setError('رمز الدخول غير صحيح، حاول مرة أخرى.')
    return
  }
    // نبدأ جلسة المسؤول في LocalStorage
  startAdminSession()

  // توجيه مباشر للوحة التحكم
  window.location.href = '/app'

    const entered = normalizeCode(code)

    if (!entered) {
      setError('من فضلك أدخل رمز الدخول.')
      return
    }

    if (entered === expectedCode) {
      // نجاح
      startAdminSession()
setError('')
// تنقّل مباشر مع إعادة تحميل كاملة
window.location.href = '/app'

    } else {
      setError('الرمز غير صحيح، تأكد من كتابة 1234 بالأرقام الإنجليزية.')
    }
  }

  const handleBackToHome = () => {
  clearAdminSession()
  window.location.href = '/'
}


  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-5">
        {/* الهيدر */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500 mb-1">لوحة تحكم</p>
            <h1 className="text-lg md:text-xl font-semibold text-slate-900">
              لحظة فن – دخول المسؤول
            </h1>
          </div>
          <img
            src={logoImg}
            alt="Art Moment Logo"
            className="w-12 h-12 rounded-2xl border border-slate-200 object-contain bg-slate-50"
          />
        </div>

        {/* نموذج رمز الدخول */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs text-slate-600">
              رمز الدخول للوحة التحكم
            </label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-600 mt-1">
                {error}
              </p>
            )}
          </div>

          {/* زر الدخول */}
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            دخول للوحة التحكم
          </button>

          {/* زر الرجوع للصفحة الرئيسية */}
          <button
            type="button"
            onClick={handleBackToHome}
            className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            ← الرجوع للصفحة الرئيسية
          </button>

          <p className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">
            يمكن تغيير رمز الدخول من صفحة <span className="font-semibold">الإعدادات &gt; أمان لوحة التحكم</span>.
            تنتهي جلسة المسؤول تلقائياً بعد {MAX_INACTIVE_MINUTES} دقيقة من الخمول.
          </p>
        </form>
      </div>
    </div>
  )
}

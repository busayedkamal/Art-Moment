// src/pages/NotFoundPage.jsx
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-8 text-center space-y-4 max-w-sm w-full">
        <div className="space-y-1">
          <div className="text-[11px] font-mono text-slate-400">خطأ 404</div>
          <h1 className="text-xl font-bold text-slate-900">
            الصفحة غير موجودة
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            يبدو أن الرابط الذي وصلت له غير صحيح
            أو أن الصفحة تم نقلها.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            الرجوع للصفحة الرئيسية
          </Link>

          <Link
            to="/track"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            تتبّع طلب
          </Link>
        </div>
      </div>
    </div>
  )
}

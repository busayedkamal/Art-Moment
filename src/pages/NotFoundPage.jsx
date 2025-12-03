// src/pages/NotFoundPage.jsx
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-8 text-center space-y-3 max-w-sm w-full">
        <h1 className="text-xl font-bold text-slate-900">الصفحة غير موجودة</h1>
        <p className="text-sm text-slate-500">
          تأكد من صحة الرابط أو ارجع للصفحة الرئيسية.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
        >
          الرجوع للصفحة الرئيسية
        </Link>
      </div>
    </div>
  )
}

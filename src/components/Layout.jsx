import { Link } from 'react-router-dom'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* الشريط الجانبي */}
      <aside className="w-52 bg-slate-900 text-white hidden md:flex flex-col">
        <div className="px-4 py-4 border-b border-slate-700">
          <div className="text-xl font-bold">لحظة فن</div>
          <div className="text-xs text-slate-300">Art-Moment</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2 text-sm">
          <Link
            to="/"
            className="block rounded-lg px-3 py-2 hover:bg-slate-800"
          >
            لوحة التحكم
          </Link>
          <Link
            to="/app/orders"
            className="block rounded-lg px-3 py-2 hover:bg-slate-800"
          >
            الطلبات
          </Link>
          <Link
            to="/app/customers"
            className="block rounded-lg px-3 py-2 hover:bg-slate-800"
          >
            العملاء
          </Link>
          <Link
            to="/app/reports"
            className="block rounded-lg px-3 py-2 hover:bg-slate-800"
          >
            التقارير
          </Link>
        </nav>

        <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-700">
          نسخة تجريبية – إدارة طباعة الصور
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b bg-white">
          <div className="font-semibold text-slate-800 text-sm md:text-base">
            لوحة إدارة طلبات طباعة الصور
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/track"
              className="text-[11px] md:text-xs px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100"
            >
              صفحة تتبع الطلب (للعميل)
            </Link>
            <div className="text-xs text-slate-500 hidden md:block">
              المسؤول
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

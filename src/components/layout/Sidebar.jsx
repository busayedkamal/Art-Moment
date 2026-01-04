// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo-art-moment.svg'
import { clearAdminSession } from '../../utils/adminSession.js'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        [
          'flex items-center justify-between rounded-xl px-3 py-2 text-sm border',
          isActive
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
        ].join(' ')
      }
    >
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin', { replace: true })
  }

  return (
    <aside className="hidden md:flex md:w-64 md:min-h-screen md:flex-col border-r border-slate-200 bg-white">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Art Moment"
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white object-contain"
          />
          <div>
            <div className="text-sm font-bold text-slate-900">لحظة فن</div>
            <div className="text-[11px] text-slate-500">لوحة التحكم</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <NavItem to="/app" label="الملخص" />
        <NavItem to="/app/orders" label="الطلبات" />
        <NavItem to="/app/customers" label="العملاء" />
        <NavItem to="/app/reports" label="التقارير" />
        <NavItem to="/app/expenses" label="المصروفات" /> {/* 👈 تم إضافة رابط المصروفات */}
        <NavItem to="/app/settings" label="الإعدادات" />
      </div>

      <div className="mt-auto p-3 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 hover:bg-slate-100"
        >
          تسجيل خروج
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-2 px-3 py-2 rounded-xl text-sm bg-slate-900 text-white hover:bg-slate-800"
        >
          الرجوع للموقع
        </button>
      </div>
    </aside>
  )
}
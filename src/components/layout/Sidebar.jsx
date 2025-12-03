// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
import logoImg from '../../assets/logo-art-moment.svg'

// عناصر القائمة الجانبية
const navItems = [
  {
    to: '/app',
    label: 'الملخّص',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/app/orders',
    label: 'الطلبات',
    icon: <FileText size={18} />,
  },
  {
    to: '/app/customers',
    label: 'العملاء',
    icon: <Users size={18} />,
  },
  {
    to: '/app/reports',
    label: 'التقارير',
    icon: <BarChart3 size={18} />,
  },
  {
    to: '/app/settings',
    label: 'الإعدادات',
    icon: <SettingsIcon size={18} />,
  },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 bg-white border-l border-slate-200">
      <div className="flex flex-col h-full w-full">
        {/* الشعار */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden">
            <img
              src={logoImg}
              alt="Art Moment Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">
              لحظة فن | Art-Moment
            </div>
            <div className="text-[11px] text-slate-500">
              لوحة التحكم
            </div>
          </div>
        </div>

        {/* روابط القائمة */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs md:text-sm transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')
              }
              end={item.to === '/app'}
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-500">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        {/* فوتر صغير */}
        <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400">
          نسخة تجريبية داخلية لإدارة الطلبات – لحظة فن
        </div>
      </div>
    </aside>
  )
}

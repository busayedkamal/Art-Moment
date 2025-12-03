// src/components/layout/Topbar.jsx
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo-art-moment.svg'

export default function Topbar({ onLogout }) {
  const navigate = useNavigate()

  return (
    <header className="h-14 md:h-16 border-b border-slate-200 bg-white flex items-center justify-between px-3 md:px-6">
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="لحظة فن"
          className="w-9 h-9 rounded-xl object-contain bg-slate-50 border border-slate-100"
        />
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500">لوحة التحكم</span>
          <span className="text-sm md:text-base font-semibold text-slate-900">
            لحظة فن – Art Moment
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-3 py-1.5 rounded-xl text-[11px] md:text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          الرجوع للموقع
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl text-[11px] md:text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            تسجيل خروج
          </button>
        )}
      </div>
    </header>
  )
}

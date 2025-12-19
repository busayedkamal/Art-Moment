// src/components/layout/Topbar.jsx
import { useNavigate } from 'react-router-dom'
import { clearAdminSession } from '../../utils/adminSession.js'

export default function Topbar({ title = '' }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin', { replace: true })
  }

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="px-3 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-bold text-slate-900 truncate">
            {title}
          </div>
          <div className="text-[11px] text-slate-500">
            إدارة الطلبات محليًا (LocalStorage)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-2 rounded-xl text-xs border border-slate-300 hover:bg-slate-100"
          >
            الصفحة الرئيسية
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </header>
  )
}

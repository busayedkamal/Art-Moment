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
    <header className="sticky top-0 z-10 bg-[#F8F5F2]/90 backdrop-blur border-b border-[#D9A3AA]/20">
      <div className="px-3 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-bold text-[#4A4A4A] truncate">
            {title}
          </div>
          <div className="text-[11px] text-[#4A4A4A]/70">
            إدارة الطلبات محليًا (LocalStorage)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-2 rounded-xl text-xs border border-[#D9A3AA]/30 text-[#4A4A4A] hover:bg-[#D9A3AA]/10"
          >
            الصفحة الرئيسية
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl text-xs bg-[#D9A3AA] text-white hover:bg-[#C5A059]"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </header>
  )
}

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
    <header className="sticky top-0 z-10 bg-[#FAF9F7]/90 backdrop-blur border-b border-[#E8B4BC]/20">
      <div className="px-3 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-bold text-[#171717] truncate">
            {title}
          </div>
          <div className="text-[11px] text-[#171717]/70">
            إدارة الطلبات محليًا (LocalStorage)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-2 rounded-xl text-xs border border-[#E8B4BC]/30 text-[#171717] hover:bg-[#E8B4BC]/10"
          >
            الصفحة الرئيسية
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl text-xs bg-[#E8B4BC] text-white hover:bg-[#C6A56B]"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </header>
  )
}

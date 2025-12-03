// src/components/layout/Layout.jsx
import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import {
  isAdminSessionValid,
  clearAdminSession,
  touchAdminSession,
} from '../../utils/adminSession.js'

export default function Layout() {
  const navigate = useNavigate()

  useEffect(() => {
    // أي تفاعل من المسؤول داخل لوحة التحكم نعدّه نشاط
    const handleActivity = () => {
      touchAdminSession()
    }

    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)

    // فحص دوري كل دقيقة
    const check = () => {
      if (!isAdminSessionValid()) {
        clearAdminSession()
        navigate('/admin-login', {
          replace: true,
          state: { expired: true },
        })
      }
    }

    // فحص مباشر عند فتح اللوحة
    check()
    const intervalId = setInterval(check, 60 * 1000)

    return () => {
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      clearInterval(intervalId)
    }
  }, [navigate])

  const handleLogout = () => {
    clearAdminSession()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar onLogout={handleLogout} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

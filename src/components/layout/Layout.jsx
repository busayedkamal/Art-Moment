// src/components/layout/Layout.jsx
import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

import { clearAdminSession, isAdminSessionValid, touchAdminSession } from '../../utils/adminSession.js';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  // حماية لوحة التحكم + تمديد الجلسة أثناء التصفح
  useEffect(() => {
    const handleActivity = () => {
      const ok = isAdminSessionValid();
      if (!ok) {
        clearAdminSession();
        navigate('/admin/login', { replace: true });
        return;
      }
      touchAdminSession();
    };

    // تحقق عند كل تغيير صفحة داخل لوحة التحكم
    handleActivity();

    // تمديد الجلسة عند النشاط (خفيفة بدون تخريب التصميم)
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="lg:sticky lg:top-4 h-fit">
            <Sidebar />
          </aside>

          <main className="min-w-0">
            <Topbar onLogout={handleLogout} />
            <div className="mt-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

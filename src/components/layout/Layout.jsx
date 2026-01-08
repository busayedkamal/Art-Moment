// src/components/layout/Layout.jsx
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  FileBarChart, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Wallet // 👈 1. تمت إضافة أيقونة المحفظة
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // قائمة الروابط الجانبية
  const navItems = [
    { path: '/app/dashboard', label: 'الرئيسية', icon: <LayoutDashboard size={20} /> },
    { path: '/app/orders', label: 'الطلبات', icon: <ShoppingCart size={20} /> },
    { path: '/app/customers', label: 'العملاء', icon: <Users size={20} /> },
    { path: '/app/reports', label: 'التقارير', icon: <FileBarChart size={20} /> },
    { path: '/app/expenses', label: 'المصروفات', icon: <Wallet size={20} /> }, // 👈 2. تمت إضافة رابط المصروفات هنا
    { path: '/app/settings', label: 'الإعدادات', icon: <Settings size={20} /> },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Sidebar - Desktop & Mobile */}
      <aside className={`
        fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Area */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
            <span className="text-lg font-bold tracking-wider">Art Moment</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut size={20} />
              تسجيل خروج
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full w-full">
        {/* Top Header (Mobile Only) */}
        <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
          <span className="font-bold text-slate-900">لوحة التحكم</span>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
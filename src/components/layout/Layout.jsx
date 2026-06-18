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
  Wallet,
  Search,
  Home
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/app/dashboard', label: 'الرئيسية',   icon: <LayoutDashboard size={20} /> },
    { path: '/app/orders',    label: 'الطلبات',    icon: <ShoppingCart size={20} /> },
    { path: '/app/customers', label: 'العملاء',    icon: <Users size={20} /> },
    { path: '/app/reports',   label: 'التقارير',   icon: <FileBarChart size={20} /> },
    { path: '/app/expenses',  label: 'المصروفات',  icon: <Wallet size={20} /> },
    { path: '/track',         label: 'تتبع الطلب', icon: <Search size={20} /> },
    { path: '/app/settings',  label: 'الإعدادات',  icon: <Settings size={20} /> },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="bg-[#F8F5F2] min-h-screen">

      {/* ══════════════════════════════════════════════
          السايدبار — fixed دائماً على الجوال والديسكتوب
          h-screen يضمن الارتفاع الكامل في كل الحالات
      ══════════════════════════════════════════════ */}
      <aside className={`
        fixed top-0 right-0 z-50
        w-64 h-[100dvh]
        bg-[#4A4A4A] text-white
        flex flex-col
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>

        {/* الشعار */}
        <div className="flex-none flex h-16 items-center justify-between px-6 border-b border-white/10">
          <span className="text-lg font-bold tracking-wider">Art Moment</span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* الروابط — flex-1 + min-h-0 يضمنان التمرير الداخلي دون تجاوز الشاشة */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
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
                    ? 'bg-gradient-to-b from-[#D9A3AA] to-[#C5A059] text-white shadow-lg shadow-[#D9A3AA]/25'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'}
                `}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* الأزرار السفلية — flex-none يثبّتها أسفل الشاشة دائماً */}
        <div className="flex-none p-4 border-t border-white/10 space-y-1">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Home size={20} />
            الصفحة الرئيسية
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={20} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          المحتوى الرئيسي
          md:pr-64 = إزاحة 256px عن السايدبار (RTL: right padding)
      ══════════════════════════════════════════════ */}
      <div className="md:pr-64 flex flex-col min-h-screen">

        {/* هيدر الجوال فقط */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-white border-b border-[#D9A3AA]/20 px-4 py-3 shadow-sm">
          <span className="font-bold text-[#4A4A4A]">لوحة التحكم</span>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-[#4A4A4A]/80 hover:bg-[#F8F5F2] rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* محتوى الصفحة */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* طبقة التعتيم خلف السايدبار على الجوال */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

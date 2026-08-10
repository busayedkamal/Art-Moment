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
  Home,
  Package,
  ShoppingBag,
  Bell,
  History,
  ClipboardList,
  ChartNoAxesCombined
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Layout() {
  const { signOut } = useAuth();
  const { isArabic } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/app/dashboard', label: 'الرئيسية',   icon: <LayoutDashboard size={20} /> },
    { path: '/app/tasks', label: 'مهام تحتاج إجراء', icon: <ClipboardList size={20} /> },
    { path: '/app/orders',    label: 'الطلبات',    icon: <ShoppingCart size={20} /> },
    { path: '/app/customers', label: 'العملاء',    icon: <Users size={20} /> },
    { path: '/app/reports',   label: 'التقارير',   icon: <FileBarChart size={20} /> },
    { path: '/app/expenses',  label: 'المصروفات',  icon: <Wallet size={20} /> },
    { path: '/app/products',     label: 'المتجر',         icon: <Package size={20} /> },
    { path: '/app/store-orders', label: 'طلبات المتجر',  icon: <ShoppingBag size={20} /> },
    { path: '/app/store-growth', label: 'نمو المتجر', icon: <ChartNoAxesCombined size={20} /> },
    { path: '/app/notifications', label: 'الإشعارات', icon: <Bell size={20} /> },
    { path: '/app/activity', label: 'سجل النشاط', icon: <History size={20} /> },
    { path: '/track',         label: 'تتبع الطلب', icon: <Search size={20} /> },
    { path: '/app/settings',  label: 'الإعدادات',  icon: <Settings size={20} /> },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="bg-[#FAF9F7] min-h-screen">

      {/* ══════════════════════════════════════════════
          السايدبار — fixed دائماً على الجوال والديسكتوب
          h-screen يضمن الارتفاع الكامل في كل الحالات
      ══════════════════════════════════════════════ */}
      <aside className={`
        fixed top-0 z-50 ${isArabic ? 'right-0' : 'left-0'}
        w-64 h-[100dvh]
        bg-[#171717] text-white
        flex flex-col
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen
          ? 'translate-x-0'
          : isArabic
            ? 'translate-x-full md:translate-x-0'
            : '-translate-x-full md:translate-x-0'}
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
                    ? 'bg-gradient-to-b from-[#E8B4BC] to-[#C6A56B] text-white shadow-lg shadow-[#E8B4BC]/25'
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
      <div className={`${isArabic ? 'md:pr-64' : 'md:pl-64'} flex flex-col min-h-screen w-full min-w-0`}>

        {/* هيدر الجوال فقط */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-white border-b border-[#E8B4BC]/20 px-4 py-3 shadow-sm">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-[#171717]/80 hover:bg-[#FAF9F7] rounded-lg transition-colors"
            aria-label="فتح القائمة الجانبية"
            title="فتح القائمة"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-[#171717]">لوحة التحكم</span>
        </header>

        {/* محتوى الصفحة */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-5 lg:p-6 xl:p-8">
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

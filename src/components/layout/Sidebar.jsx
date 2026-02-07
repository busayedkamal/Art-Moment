import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearAdminSession } from '../utils/auth';

import {
  LayoutGrid,
  ShoppingCart,
  Users,
  FileText,
  Receipt,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';

import logo from '../assets/logo-art-moment.svg';

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all',
          // Base (dark sidebar)
          'text-[#F8F5F2]/80 hover:text-[#F8F5F2] hover:bg-[#D9A3AA]/15',
          // Active
          isActive ? 'bg-[#D9A3AA] text-white shadow-lg shadow-[#D9A3AA]/25' : '',
        ].join(' ')
      }
    >
      {Icon ? (
        <span className="shrink-0">
          <Icon size={18} />
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearAdminSession();
      navigate('/admin/login');
    }
  };

  return (
    <aside className="w-64 h-screen bg-[#4A4A4A] text-[#F8F5F2] flex flex-col border-r border-white/10">
      <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Art Moment" className="w-10 h-10 object-contain brightness-0 invert opacity-90" />
          <div className="leading-tight">
            <div className="font-black tracking-wide">Art Moment</div>
            <div className="text-xs text-[#F8F5F2]/60 font-bold">لوحة التحكم</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        <NavItem to="/app" label="الرئيسية" icon={LayoutGrid} />
        <NavItem to="/app/orders" label="الطلبات" icon={ShoppingCart} />
        <NavItem to="/app/customers" label="العملاء" icon={Users} />
        <NavItem to="/app/reports" label="التقارير" icon={FileText} />
        <NavItem to="/app/expenses" label="المصروفات" icon={Receipt} />
        <NavItem to="/app/settings" label="الإعدادات" icon={SettingsIcon} />
      </nav>

      <div className="px-4 pb-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-[#D9A3AA]/50 text-[#F8F5F2] hover:bg-[#D9A3AA]/15 transition-colors"
        >
          <LogOut size={18} />
          تسجيل خروج
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-3 px-4 py-3 rounded-xl text-sm font-black bg-[#D9A3AA] text-white hover:bg-[#C5A059] transition-colors shadow-md shadow-black/20"
        >
          الرجوع للموقع
        </button>
      </div>
    </aside>
  );
}

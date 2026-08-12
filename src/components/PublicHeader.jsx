import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LogIn,
  Download,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';
import logo from '../assets/logo-art-moment.svg';

const copy = {
  ar: {
    print: 'اطبع صورك',
    store: 'المتجر',
    track: 'تتبع طلبك',
    about: 'عن لحظة فن',
    search: 'البحث في المتجر',
    cart: 'السلة',
    login: 'تسجيل الدخول',
    account: 'حسابي',
    orders: 'طلباتي',
    install: 'تحميل التطبيق',
    menu: 'فتح القائمة',
    close: 'إغلاق القائمة',
  },
  en: {
    print: 'Print Photos',
    store: 'Store',
    track: 'Track Order',
    about: 'About Art Moment',
    search: 'Search the store',
    cart: 'Cart',
    login: 'Sign In',
    account: 'My Account',
    orders: 'My Orders',
    install: 'Install App',
    menu: 'Open menu',
    close: 'Close menu',
  },
};

export default function PublicHeader({
  cartCount = 0,
  customer = null,
  onAccountClick,
  onLoginClick,
  installAvailable = false,
  onInstall,
  showLanguage = false,
}) {
  const { language, direction } = useLanguage();
  const location = useLocation();
  const text = copy[language] || copy.ar;
  const [menuOpen, setMenuOpen] = useState(false);
  const isStore = location.pathname === '/store' || location.pathname.startsWith('/store/');

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  const accountAction = customer ? onAccountClick : onLoginClick;
  const accountLabel = customer ? text.account : text.login;

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#FAF9F7]/95 backdrop-blur-xl" dir={direction}>
      <div className="art-shell grid h-16 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 lg:flex lg:h-20 lg:justify-between">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center text-[#171717] lg:hidden"
          aria-label={menuOpen ? text.close : text.menu}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Link to="/" className="mx-auto flex min-w-0 items-center justify-center gap-2 lg:mx-0 lg:justify-start" aria-label="Art Moment">
          <img src={logo} alt="" width="44" height="44" className="h-10 w-10 object-contain" />
          <span className="hidden text-lg font-black text-[#171717] sm:block">
            {language === 'en' ? 'Art Moment' : 'لحظة فن'}
          </span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex" aria-label={language === 'en' ? 'Main navigation' : 'التنقل الرئيسي'}>
          <Link
            to="/print"
            className="inline-flex min-h-11 items-center bg-[#E8B4BC] px-5 text-sm font-black text-[#171717] transition-colors hover:bg-[#171717] hover:text-white"
          >
            {text.print}
          </Link>
          <Link to="/store" className={`px-3 py-3 text-sm font-bold transition-colors hover:text-[#B96F7D] ${isStore ? 'text-[#B96F7D]' : 'text-[#171717]/72'}`}>
            {text.store}
          </Link>
          <Link to="/track" className="px-3 py-3 text-sm font-bold text-[#171717]/72 transition-colors hover:text-[#B96F7D]">
            {text.track}
          </Link>
          <Link to="/#why" className="px-3 py-3 text-sm font-bold text-[#171717]/72 transition-colors hover:text-[#B96F7D]">
            {text.about}
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Link
            to="/store?focus=search"
            className="hidden h-11 w-11 items-center justify-center border border-black/10 bg-white text-[#171717] transition-colors hover:border-[#C6A56B] md:flex"
            aria-label={text.search}
            title={text.search}
          >
            <Search size={19} />
          </Link>
          <Link
            to="/store/cart"
            className="relative flex h-11 w-11 items-center justify-center border border-black/10 bg-white text-[#171717] transition-colors hover:border-[#E8B4BC]"
            aria-label={text.cart}
            title={text.cart}
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E8B4BC] px-1 text-[9px] font-black text-[#171717]">
                {cartCount}
              </span>
            )}
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            {showLanguage && <LanguageToggle />}
            {accountAction ? (
              <button
                type="button"
                onClick={accountAction}
                className="inline-flex min-h-11 items-center gap-2 border border-black/10 bg-white px-3 text-xs font-black text-[#171717] transition-colors hover:border-[#C6A56B]"
              >
                {customer ? <User size={17} /> : <LogIn size={17} />}
                {accountLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full border-b border-black/10 bg-[#FAF9F7] px-4 pb-5 pt-3 shadow-xl lg:hidden">
          <nav className="mx-auto grid max-w-xl gap-1" aria-label={text.menu}>
            <Link to="/print" className="flex min-h-12 items-center justify-center bg-[#171717] px-5 text-sm font-black text-white">
              {text.print}
            </Link>
            <Link to="/store" className="flex min-h-11 items-center border-b border-black/10 px-2 text-sm font-bold">{text.store}</Link>
            <Link to="/track" className="flex min-h-11 items-center border-b border-black/10 px-2 text-sm font-bold">{text.track}</Link>
            <Link to="/#why" className="flex min-h-11 items-center border-b border-black/10 px-2 text-sm font-bold">{text.about}</Link>
            {customer && <Link to="/store/orders" className="flex min-h-11 items-center border-b border-black/10 px-2 text-sm font-bold">{text.orders}</Link>}
            <div className="mt-3 flex items-center gap-2">
              {showLanguage && <LanguageToggle />}
              {accountAction && (
                <button type="button" onClick={accountAction} className="flex min-h-11 flex-1 items-center justify-center gap-2 border border-black/10 bg-white px-4 text-sm font-black">
                  {customer ? <User size={18} /> : <LogIn size={18} />} {accountLabel}
                </button>
              )}
            </div>
            {installAvailable && onInstall && (
              <button type="button" onClick={onInstall} className="mt-1 flex min-h-11 items-center justify-center gap-2 border border-black/10 bg-white px-4 text-sm font-black">
                <Download size={18} /> {text.install}
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

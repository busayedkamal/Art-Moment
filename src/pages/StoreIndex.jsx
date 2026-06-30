import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { clearCustomerSession, getCustomerSession } from '../utils/customerSession';
import {
  Search, MessageCircle, Image as ImageIcon, ShoppingCart,
  Menu, X, Download, AlertCircle, ShoppingBag, Plus,
  ChevronRight, ChevronLeft, ArrowLeft, Sparkles, User, LogOut, Package, Wallet
} from 'lucide-react';
import CustomerAuthModal from '../components/CustomerAuthModal';

import logo from '../assets/logo-art-moment.svg';
import fallbackLogo from '../assets/logo.png';

const fromDb = (p) => ({
  id:          p.id,
  name:        p.name,
  description: p.description || '',
  price:       p.price,
  category:    p.category,
  image:       p.image       || null,
  hoverImage:  p.hover_image || null,
  sortOrder:   p.sort_order  ?? 0,
  inStock:     p.in_stock    ?? true,
});

export default function StoreIndex() {
  const [products, setProducts]             = useState([]);
  const [searchQ, setSearchQ]               = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart]                     = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [currentPage, setCurrentPage]       = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const itemsPerPage = 12;

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable]   = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen]       = useState(false);
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [customer, setCustomer]               = useState(null);

  useEffect(() => {
    setCustomer(getCustomerSession());
  }, []);

  const handleLogout = () => {
    clearCustomerSession();
    setCustomer(null);
    toast.success('تم تسجيل الخروج بنجاح');
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setProducts((data || []).map(fromDb));
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
    setCart(savedCart);
  }, []);

  useEffect(() => {
    localStorage.setItem('art_moment_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIosDevice && !isStandalone) setIsIOS(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("الرجاء الضغط على زر 'مشاركة' ثم 'إضافة للشاشة الرئيسية'");
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const getProductQty = (id) => cart.find(item => item.id === id)?.qty || 0;
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const uniqueCategories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const getCategoryLabel = (cat) => {
    if (cat === 'all')      return 'الكل';
    if (cat === 'albums')   return 'ألبومات';
    if (cat === 'frames')   return 'إطارات';
    if (cat === 'stickers') return 'ملصقات';
    return cat;
  };

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchCat    = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  }), [products, activeCategory, searchQ]);

  useEffect(() => { setCurrentPage(1); }, [activeCategory, searchQ]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : 'auto';
  }, [isModalOpen]);

  const getRecommendations = (currentProd) => {
    if (!currentProd) return [];
    const getProductText = (product) =>
      `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
    const hasSmallPrintSize = (text) =>
      /(?:10\s*[x×*]\s*15)|(?:4\s*[x×*]\s*6)|(?:4×6)|(?:10×15)/i.test(text);
    const currentText = getProductText(currentProd);
    const isA4 = currentText.includes('a4');
    const isSmall = hasSmallPrintSize(currentText);

    return products
      .filter(p => p.id !== currentProd.id && p.inStock)
      .map(product => {
        const text = getProductText(product);
        let score = product.category !== currentProd.category ? 1 : 0;
        if (isA4) {
          if (product.category === 'frames') score += 4;
          if (text.includes('a4')) score += 3;
        }
        if (isSmall) {
          if (product.category === 'albums') score += 4;
          if (hasSmallPrintSize(text)) score += 3;
        }
        return { product, score };
      })
      .sort((a, b) => b.score - a.score || (a.product.sortOrder || 0) - (b.product.sortOrder || 0))
      .map(item => item.product)
      .slice(0, 2);
  };

  return (
    <div className="art-page min-h-screen font-sans relative overflow-x-hidden" dir="rtl">

      {/* Navbar */}
      <header className={`sticky top-0 z-50 art-nav transition-all duration-300 ${scrolled ? 'art-nav-scrolled' : ''}`}>
        <div className="art-shell h-20 flex items-center justify-between">

          <div className="flex items-center gap-1 sm:gap-3">
            <button className="md:hidden p-1 -mr-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <img src={logo} alt="Art Moment Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-black text-[#4A4A4A] leading-none">لحظة فن</span>
                <span className="text-[9px] sm:text-[10px] text-[#C5A059] font-bold tracking-widest uppercase">Art Moment</span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-[#4A4A4A]/80">
            <Link to="/" className="hover:text-[#D9A3AA] transition-colors">الرئيسية</Link>
            <span className="text-[#D9A3AA] flex items-center gap-1.5"><ShoppingBag size={15} /> المتجر</span>
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            {(isInstallable || isIOS) && (
              <button onClick={handleInstallClick} className="flex items-center gap-2 px-4 py-2 bg-[#D9A3AA] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#C5A059] transition-all">
                <Download size={16} /> <span className="hidden sm:inline">تحميل التطبيق</span>
              </button>
            )}
            <Link to="/store/cart" className="relative p-2 bg-white/70 rounded-full hover:bg-[#D9A3AA]/10 transition-colors border border-[#D9A3AA]/20">
              <ShoppingCart size={20} className="text-[#4A4A4A]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D9A3AA] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {customer ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={() => setIsAccountSidebarOpen(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#4A4A4A] bg-white px-3 py-2 rounded-full border border-[#D9A3AA]/20 hover:bg-[#D9A3AA]/10 transition-colors shadow-sm">
                  <User size={16} className="text-[#C5A059]" /> {customer.name ? customer.name.split(' ')[0] : 'حسابي'}
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 px-3 py-2 rounded-full hover:text-[#D9A3AA] transition-all shadow-sm text-xs font-bold">
                <User size={16} /> <span className="hidden sm:inline">دخول</span>
              </button>
            )}
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#F8F5F2] border-t border-[#D9A3AA]/10 p-4 space-y-3 shadow-xl absolute w-full z-50">
            <Link to="/" className="block py-2 text-[#4A4A4A] font-bold" onClick={() => setIsMobileMenuOpen(false)}>الرئيسية</Link>
            <span className="flex items-center gap-2 py-2 text-[#D9A3AA] font-bold"><ShoppingBag size={16} /> المتجر</span>
            <Link to="/track" className="block w-full text-center py-3 mt-2 bg-white rounded-xl font-bold text-[#4A4A4A] border border-[#D9A3AA]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>تتبع طلبك</Link>
          </div>
        )}
      </header>

      {/* Main Store Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-[#4A4A4A] mb-4">متجر <span className="text-[#D9A3AA]">لحظة فن</span></h2>
          <p className="text-[#4A4A4A]/60 max-w-xl mx-auto">تصفح تشكيلتنا المتكاملة من الألبومات، الإطارات، والملحقات الفنية.</p>
        </div>

        {/* Search & Filters */}
        <div className="art-panel flex flex-col md:flex-row gap-4 items-center justify-between mb-8 p-4 rounded-[1.5rem]">
          <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border ${
                  activeCategory === cat
                    ? 'bg-[#D9A3AA] text-white border-[#D9A3AA] shadow-md'
                    : 'bg-[#F8F5F2] text-[#4A4A4A] border-transparent hover:border-[#D9A3AA]/30'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="ابحث هنا..."
              className="art-input w-full rounded-full px-4 py-2.5 pr-10 outline-none text-sm"
            />
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
            {searchQ && (
              <X size={14} onClick={() => setSearchQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer text-red-400" />
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
          {currentProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[#4A4A4A]/40 font-bold text-lg">لا توجد منتجات مطابقة لبحثك</div>
          ) : (
            currentProducts.map(product => (
              <div
                key={product.id}
                onClick={() => { if (product.inStock) { setSelectedProduct(product); setIsModalOpen(true); } }}
                className={`art-product-card p-4 group flex flex-col relative overflow-hidden ${product.inStock ? 'cursor-pointer' : 'opacity-80 cursor-not-allowed'}`}
              >

                <div className={`art-product-media aspect-square rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center transition-transform duration-500 ${product.inStock ? 'group-hover:scale-105' : 'grayscale'}`}>
                  {product.image ? (
                    <>
                      <img src={product.image} alt={product.name}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${product.hoverImage ? 'group-hover:opacity-0' : ''}`} />
                      {product.hoverImage && (
                        <img src={product.hoverImage} alt={`${product.name} hover`}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      )}
                    </>
                  ) : (
                    <img src={fallbackLogo} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-8 opacity-20 grayscale mix-blend-multiply" />
                  )}

                  {!product.inStock && (
                    <div className="absolute top-3 left-3 z-20 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                      <AlertCircle size={12} /> نفدت الكمية
                    </div>
                  )}
                  {product.inStock && getProductQty(product.id) > 0 && (
                    <span className="absolute top-2 right-2 bg-[#C5A059] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                      في السلة: {getProductQty(product.id)}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col px-1">
                  <h3 className="font-black text-[#4A4A4A] text-sm md:text-base line-clamp-2 leading-snug mb-1">{product.name}</h3>
                  <p className="text-[#4A4A4A]/50 text-xs line-clamp-2 mb-4 flex-1">{product.description}</p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F8F5F2]">
                    <span className="font-black text-[#D9A3AA] text-lg">{product.price} <span className="text-[10px] text-[#4A4A4A]/60">ر.س</span></span>
                    <button
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      disabled={!product.inStock}
                      className={`p-2.5 rounded-xl transition-all ${product.inStock ? 'bg-[#4A4A4A] text-white hover:bg-[#C5A059] shadow-md' : 'bg-gray-200 text-gray-400'}`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#D9A3AA]/20 text-[#4A4A4A] hover:bg-[#F8F5F2] disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>

            <div className="flex items-center gap-1.5" dir="ltr">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                      currentPage === page
                        ? 'bg-[#4A4A4A] text-white shadow-md'
                        : 'bg-white border border-[#D9A3AA]/20 text-[#4A4A4A] hover:bg-[#F8F5F2]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#D9A3AA]/20 text-[#4A4A4A] hover:bg-[#F8F5F2] disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </main>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10">
          <Link to="/store/cart" className="flex items-center gap-3 bg-[#C5A059] text-white px-6 py-3.5 rounded-full font-black hover:bg-[#4A4A4A] transition-all shadow-xl hover:scale-105 border-2 border-white">
            <ShoppingCart size={20} /> عرض السلة ({cartCount}) <ArrowLeft size={18} />
          </Link>
        </div>
      )}

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setCustomer(getCustomerSession());
        }}
      />

      {/* Customer Account Sidebar */}
      {isAccountSidebarOpen && customer && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAccountSidebarOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-[#F8F5F2] h-[100dvh] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col" dir="rtl">

            {/* Header */}
            <div className="art-auth-header text-white p-6 pb-8 relative overflow-hidden shrink-0 rounded-bl-3xl">
              <button onClick={() => setIsAccountSidebarOpen(false)} className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20">
                <X size={18} />
              </button>
              <div className="flex items-center gap-4 mt-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] rounded-full flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white shrink-0">
                  {customer.name ? customer.name.charAt(0) : <User size={28} />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{customer.name || 'عميل لحظة فن'}</h2>
                  <p className="text-white/70 text-sm font-mono mt-1 truncate" dir="ltr">{customer.phone}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Link to="/track" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#D9A3AA]/10 flex flex-col items-center justify-center gap-2 hover:border-[#D9A3AA]/40 transition-colors group">
                  <div className="w-12 h-12 bg-[#D9A3AA]/10 rounded-full flex items-center justify-center text-[#D9A3AA] group-hover:scale-110 transition-transform">
                    <Package size={22} />
                  </div>
                  <span className="font-bold text-sm text-[#4A4A4A]">طلباتي</span>
                </Link>
                <Link to="/track" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#C5A059]/10 flex flex-col items-center justify-center gap-2 hover:border-[#C5A059]/40 transition-colors group">
                  <div className="w-12 h-12 bg-[#C5A059]/10 rounded-full flex items-center justify-center text-[#C5A059] group-hover:scale-110 transition-transform">
                    <Wallet size={22} />
                  </div>
                  <span className="font-bold text-sm text-[#4A4A4A]">المحفظة</span>
                </Link>
              </div>

              {/* Profile Details */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D9A3AA]/10">
                <h3 className="font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
                  <User size={16} className="text-[#C5A059]" /> بيانات الحساب
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#4A4A4A]/50 block mb-1">الاسم</label>
                    <input type="text" defaultValue={customer.name || ''} readOnly className="w-full bg-[#F8F5F2] border border-transparent rounded-xl px-4 py-3 text-sm outline-none text-[#4A4A4A] font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#4A4A4A]/50 block mb-1">البريد الإلكتروني</label>
                    <input type="email" defaultValue={customer.email || 'غير مسجل'} readOnly className="w-full bg-[#F8F5F2] border border-transparent rounded-xl px-4 py-3 text-sm outline-none dir-ltr text-right text-[#4A4A4A] font-bold" />
                  </div>
                  <a
                    href="https://wa.me/966569663697?text=مرحباً، أرغب بتعديل بيانات حسابي"
                    target="_blank" rel="noreferrer"
                    className="w-full py-3 mt-2 bg-[#F8F5F2] text-[#4A4A4A] font-bold text-xs rounded-xl hover:bg-[#D9A3AA]/10 transition-colors border border-[#D9A3AA]/20 block text-center"
                  >
                    طلب تعديل البيانات
                  </a>
                </div>
              </div>
            </div>

            {/* Footer / Logout */}
            <div className="p-6 bg-white border-t border-[#D9A3AA]/10 shrink-0">
              <button
                onClick={() => { setIsAccountSidebarOpen(false); handleLogout(); }}
                className="w-full py-4 bg-red-50 text-red-500 font-black text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm"
              >
                <LogOut size={18} /> تسجيل الخروج
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

          <div className="relative w-full max-w-4xl bg-[#F8F5F2] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col sm:flex-row max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 left-4 z-10 w-10 h-10 bg-white/50 backdrop-blur rounded-full flex items-center justify-center text-[#4A4A4A] hover:bg-white transition-colors">
              <X size={20} />
            </button>

            {/* Image */}
            <div className="w-full sm:w-1/2 bg-white relative h-64 sm:h-auto shrink-0 flex items-center justify-center p-8">
              {selectedProduct.image
                ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" />
                : <ImageIcon size={64} className="text-[#D9A3AA]/20" />
              }
            </div>

            {/* Details */}
            <div className="w-full sm:w-1/2 p-6 sm:p-10 overflow-y-auto flex flex-col">
              <span className="inline-block px-3 py-1 bg-[#D9A3AA]/10 text-[#D9A3AA] text-[10px] font-black rounded-full mb-3 w-fit">
                {getCategoryLabel(selectedProduct.category)}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#4A4A4A] mb-2">{selectedProduct.name}</h2>
              <p className="text-2xl font-black text-[#C5A059] mb-6">{selectedProduct.price} <span className="text-sm">ر.س</span></p>
              <p className="text-[#4A4A4A]/70 text-sm leading-relaxed mb-8 bg-white p-4 rounded-2xl border border-[#D9A3AA]/10">
                {selectedProduct.description || 'لا يوجد وصف متاح لهذا المنتج حالياً.'}
              </p>

              <button
                onClick={() => { addToCart(selectedProduct); setIsModalOpen(false); }}
                className="w-full py-4 rounded-xl font-black text-white bg-[#4A4A4A] hover:bg-[#D9A3AA] transition-colors flex items-center justify-center gap-2 shadow-lg mb-8"
              >
                <Plus size={20} /> إضافة إلى السلة
              </button>

              {/* Smart Recommendations */}
              {getRecommendations(selectedProduct).length > 0 && (
                <div className="mt-auto border-t border-[#D9A3AA]/10 pt-6">
                  <h4 className="text-sm font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
                    <Sparkles size={16} className="text-[#C5A059]" /> أكملي مجموعتك الفنية
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {getRecommendations(selectedProduct).map(rec => (
                      <div
                        key={rec.id}
                        onClick={() => setSelectedProduct(rec)}
                        className="bg-white p-2.5 rounded-xl border border-[#D9A3AA]/10 flex items-center gap-3 cursor-pointer hover:border-[#C5A059]/40 transition-colors group"
                      >
                        <div className="w-12 h-12 bg-[#F8F5F2] rounded-lg overflow-hidden shrink-0">
                          {rec.image
                            ? <img src={rec.image} alt={rec.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            : <ImageIcon className="w-full h-full p-3 opacity-20" />
                          }
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#4A4A4A] line-clamp-1">{rec.name}</p>
                          <p className="text-xs font-black text-[#D9A3AA]">{rec.price} ر.س</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

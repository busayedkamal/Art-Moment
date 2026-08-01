import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { clearCustomerSession, getCustomerSession } from '../utils/customerSession';
import {
  canAddProductToCart,
  getStockLabel,
  isProductAvailable,
  normalizeStockQuantity,
} from '../utils/productStock';
import {
  Search, MessageCircle, Image as ImageIcon, ShoppingCart,
  Menu, X, Download, AlertCircle, ShoppingBag, Plus,
  ArrowLeft, Sparkles, User, LogOut, Package, Wallet,
  ArrowUpDown, ChevronDown
} from 'lucide-react';
import CustomerAuthModal from '../components/CustomerAuthModal';
import { markCustomerAuthPromptShown, shouldAutoOpenCustomerAuth } from '../utils/customerAuthPrompt';
import { getCartLineKey, localizeProductOptions } from '../utils/productOptions';
import { trackStoreEvent } from '../utils/storeAnalytics';
import { useLanguage } from '../contexts/LanguageContext';

import logo from '../assets/logo-art-moment.svg';
import fallbackLogo from '../assets/logo.png';

const fromDb = (p, language) => {
  const stockQuantity = normalizeStockQuantity(p.stock_quantity);
  return {
    id:          p.id,
    name:        language === 'en' && p.name_en ? p.name_en : p.name,
    description: language === 'en' && p.description_en ? p.description_en : (p.description || ''),
    price:       p.price,
    category:    p.category,
    image:       p.image       || null,
    hoverImage:  p.hover_image || null,
    sortOrder:   p.sort_order  ?? 0,
    stockQuantity,
    inStock:     (p.in_stock ?? true) && (stockQuantity === null || stockQuantity > 0),
    productOptions: localizeProductOptions(p.product_options, language),
    galleryImages: Array.isArray(p.gallery_images) ? p.gallery_images.filter(Boolean) : [],
    specifications: language === 'en'
      && p.specifications_en
      && typeof p.specifications_en === 'object'
      && Object.keys(p.specifications_en).length > 0
      ? p.specifications_en
      : (p.specifications && typeof p.specifications === 'object' ? p.specifications : {}),
  };
};

const getLocalizedCategoryLabel = (category, language) => {
  const labels = {
    all: { ar: 'الكل', en: 'All' },
    albums: { ar: 'ألبومات', en: 'Albums' },
    'ألبومات': { ar: 'ألبومات', en: 'Albums' },
    frames: { ar: 'إطارات', en: 'Frames' },
    'إطارات': { ar: 'إطارات', en: 'Frames' },
    stickers: { ar: 'ملصقات', en: 'Stickers' },
    'ملصقات': { ar: 'ملصقات', en: 'Stickers' },
    printing: { ar: 'طباعة', en: 'Printing' },
    'طباعة': { ar: 'طباعة', en: 'Printing' },
  };
  return labels[category]?.[language] || category;
};

export default function StoreIndex() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [products, setProducts]             = useState([]);
  const [searchQ, setSearchQ]               = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortMode, setSortMode]             = useState('featured');
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError]   = useState('');
  const [cart, setCart]                     = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [columnCount, setColumnCount]       = useState(() => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth >= 1280) return 4;
    if (window.innerWidth >= 768) return 3;
    return 2;
  });
  const [visibleCount, setVisibleCount]     = useState(columnCount);
  const loadMoreRef = useRef(null);
  const lastRevealAtRef = useRef(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable]   = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen]       = useState(false);
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [customer, setCustomer]               = useState(null);

  useEffect(() => {
    setCustomer(getCustomerSession());
  }, []);

  useEffect(() => {
    if (!shouldAutoOpenCustomerAuth()) return undefined;

    const timeoutId = window.setTimeout(() => {
      markCustomerAuthPromptShown();
      setIsAuthModalOpen(true);
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const updateColumnCount = () => {
      const nextCount = window.innerWidth >= 1280 ? 4 : window.innerWidth >= 768 ? 3 : 2;
      setColumnCount(nextCount);
    };

    window.addEventListener('resize', updateColumnCount);
    return () => {
      window.removeEventListener('resize', updateColumnCount);
    };
  }, []);

  const handleLogout = () => {
    clearCustomerSession();
    setCustomer(null);
    toast.success('تم تسجيل الخروج بنجاح');
  };

  const fetchProducts = useCallback(async () => {
    try {
      setIsProductsLoading(true);
      setProductsError('');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setProducts((data || []).map((product) => fromDb(product, language)));
    } catch (err) {
      console.error('Error fetching products:', err);
      setProductsError('تعذر تحميل المنتجات حالياً. تحققي من اتصال Supabase أو سياسات القراءة العامة للمنتجات.');
    } finally {
      setIsProductsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchProducts();

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
    setCart(savedCart);
    trackStoreEvent('store_visit');
  }, [fetchProducts]);

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
    if (product.productOptions?.length > 0) {
      navigate(`/store/products/${product.id}`);
      toast('اختاري خصائص المنتج أولاً');
      return;
    }

    const currentQty = getProductQty(product.id);
    if (!canAddProductToCart(product, currentQty)) {
      toast.error('وصلت إلى الكمية المتوفرة لهذا المنتج');
      return;
    }

    setCart(prev => {
      const cartKey = getCartLineKey(product.id);
      const existing = prev.find(item => (
        String(item.cartKey || getCartLineKey(item.id, item.selectedOptions)) === cartKey
      ));
      if (existing) return prev.map(item => item.id === product.id ? { ...item, ...product, qty: item.qty + 1 } : item);
      return [...prev, { ...product, cartKey, selectedOptions: {}, selectedOptionLabels: [], qty: 1 }];
    });
    trackStoreEvent('add_to_cart', { productId: product.id, quantity: 1 });
  };

  const getProductQty = (id) => cart
    .filter(item => String(item.id) === String(id))
    .reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const uniqueCategories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const categoryCounts = useMemo(() => products.reduce((counts, product) => {
    const category = product.category || 'uncategorized';
    counts.all += 1;
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, { all: 0 }), [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQ.trim().toLowerCase();
    const matches = products.filter(p => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const productText = `${p.name || ''} ${p.description || ''}`.toLowerCase();
      const matchSearch = !normalizedSearch || productText.includes(normalizedSearch);
      return matchCat && matchSearch;
    });

    return [...matches].sort((a, b) => {
      if (sortMode === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortMode === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortMode === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [products, activeCategory, searchQ, sortMode]);

  useEffect(() => {
    setVisibleCount(columnCount);
    lastRevealAtRef.current = 0;
  }, [activeCategory, searchQ, sortMode, columnCount]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMoreProducts = visibleCount < filteredProducts.length;

  const revealNextProductRow = useCallback(() => {
    setVisibleCount((current) => Math.min(current + columnCount, filteredProducts.length));
  }, [columnCount, filteredProducts.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreProducts) return undefined;

    const maybeRevealNextRow = () => {
      const rect = target.getBoundingClientRect();
      if (rect.top > window.innerHeight + 140) return;

      const now = Date.now();
      if (now - lastRevealAtRef.current < 450) return;
      lastRevealAtRef.current = now;
      revealNextProductRow();
    };

    window.addEventListener('scroll', maybeRevealNextRow, { passive: true });
    window.addEventListener('touchmove', maybeRevealNextRow, { passive: true });
    window.addEventListener('wheel', maybeRevealNextRow, { passive: true });
    return () => {
      window.removeEventListener('scroll', maybeRevealNextRow);
      window.removeEventListener('touchmove', maybeRevealNextRow);
      window.removeEventListener('wheel', maybeRevealNextRow);
    };
  }, [hasMoreProducts, revealNextProductRow]);

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
    <div className="art-page min-h-screen font-[Tajawal] relative overflow-x-hidden" dir="rtl">

      {/* Navbar */}
      <header className={`sticky top-0 z-50 art-nav transition-all duration-300 ${scrolled ? 'art-nav-scrolled' : ''}`}>
        <div className="art-shell h-20 flex items-center justify-between">

          <div className="flex items-center gap-1 sm:gap-3">
            <button
              className="md:hidden p-1 -mr-2 text-[#4A4A4A]"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              title={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <img src={logo} alt="Art Moment Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-black text-[#4A4A4A] leading-none">
                  {language === 'en' ? 'Art Moment' : 'لحظة فن'}
                </span>
                <span className="text-[9px] sm:text-[10px] text-[#C5A059] font-bold tracking-widest uppercase">
                  {language === 'en' ? 'Photo Printing & Gifts' : 'Art Moment'}
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-[#4A4A4A]/80">
            <Link to="/" className="hover:text-[#D9A3AA] transition-colors">الرئيسية</Link>
            <span className="text-[#D9A3AA] flex items-center gap-1.5"><ShoppingBag size={15} /> المتجر</span>
            <Link to="/store/orders" className="hover:text-[#D9A3AA] transition-colors">طلباتي</Link>
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
          </nav>

          <div className={`flex items-center gap-3 sm:gap-4 ${language === 'en' ? 'pr-20' : 'pl-20'}`}>
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
            <Link to="/store/orders" className="block w-full text-center py-3 mt-2 bg-white rounded-xl font-bold text-[#4A4A4A] border border-[#D9A3AA]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>طلباتي</Link>
            <Link to="/track" className="block w-full text-center py-3 bg-white rounded-xl font-bold text-[#4A4A4A] border border-[#D9A3AA]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>تتبع طلبك</Link>
          </div>
        )}
      </header>

      {/* Main Store Content */}
      <main className="art-shell py-8 sm:py-10 lg:py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-[#4A4A4A] mb-4">
            {language === 'en' ? 'Art Moment Store' : <>متجر <span className="text-[#D9A3AA]">لحظة فن</span></>}
          </h2>
          <p className="text-[#4A4A4A]/60 max-w-xl mx-auto">
            {language === 'en'
              ? 'Browse our complete collection of albums, frames, prints, and artistic accessories.'
              : 'تصفح تشكيلتنا المتكاملة من الألبومات، الإطارات، والملحقات الفنية.'}
          </p>
        </div>

        {/* Search & Filters */}
        <div className="art-panel mb-4 p-4 rounded-[1.5rem]">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex overflow-x-auto gap-2 w-full lg:w-auto pb-2 lg:pb-0 hide-scrollbar">
              {uniqueCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border inline-flex items-center gap-2 ${
                    activeCategory === cat
                      ? 'bg-[#D9A3AA] text-white border-[#D9A3AA] shadow-md'
                      : 'bg-[#F8F5F2] text-[#4A4A4A] border-transparent hover:border-[#D9A3AA]/30'
                  }`}
                >
                  <span>{getLocalizedCategoryLabel(cat, language)}</span>
                  <span className={`min-w-6 h-6 px-2 rounded-full text-[11px] flex items-center justify-center ${
                    activeCategory === cat ? 'bg-white/20 text-white' : 'bg-white text-[#C5A059]'
                  }`}>
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3 w-full lg:w-[34rem]">
              <div className="relative">
                <input
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder={language === 'en' ? 'Search by product name or description...' : 'ابحث باسم المنتج أو الوصف...'}
                  className="art-input w-full rounded-full px-4 py-2.5 pr-10 outline-none text-sm"
                />
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
                {searchQ && (
                  <X size={14} onClick={() => setSearchQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer text-red-400" />
                )}
              </div>

              <label className="relative block">
                <ArrowUpDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C5A059] pointer-events-none" />
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="art-input w-full appearance-none rounded-full px-4 py-2.5 pr-10 pl-8 outline-none text-sm font-bold bg-white"
                  aria-label={t('ترتيب المنتجات')}
                >
                  <option value="featured">الأولوية</option>
                  <option value="price_asc">السعر: الأقل</option>
                  <option value="price_desc">السعر: الأعلى</option>
                  <option value="name">الاسم</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 text-sm">
          <p className="text-[#4A4A4A]/60 font-bold">
            {language === 'en'
              ? `Showing ${filteredProducts.length} of ${products.length} products`
              : `يعرض ${filteredProducts.length} منتج من أصل ${products.length}`}
          </p>
          {(searchQ || activeCategory !== 'all' || sortMode !== 'featured') && (
            <button
              type="button"
              onClick={() => {
                setSearchQ('');
                setActiveCategory('all');
                setSortMode('featured');
              }}
              className="w-fit px-4 py-2 rounded-full bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 font-bold hover:bg-[#D9A3AA]/10 transition-colors"
            >
              مسح التصفية
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-7 mb-12">
          {isProductsLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="art-product-card p-3 sm:p-4 lg:p-5 overflow-hidden">
                <div className="art-product-media aspect-square rounded-2xl mb-4 bg-white/80 animate-pulse" />
                <div className="h-4 w-4/5 bg-white rounded-full animate-pulse mb-3" />
                <div className="h-3 w-3/5 bg-white rounded-full animate-pulse mb-6" />
                <div className="flex items-center justify-between pt-3 border-t border-[#F8F5F2]">
                  <div className="h-5 w-20 bg-white rounded-full animate-pulse" />
                  <div className="h-10 w-10 bg-white rounded-xl animate-pulse" />
                </div>
              </div>
            ))
          ) : productsError ? (
            <div className="col-span-full art-panel text-center py-14 px-6 rounded-[1.5rem]">
              <AlertCircle size={34} className="mx-auto mb-4 text-[#D9A3AA]" />
              <h3 className="text-xl font-black text-[#4A4A4A] mb-2">لم نتمكن من تحميل المنتجات</h3>
              <p className="text-[#4A4A4A]/60 max-w-lg mx-auto mb-6">{productsError}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="art-cta inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-black text-white"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[#4A4A4A]/60">
              <p className="font-black text-lg mb-4">لا توجد منتجات مطابقة لبحثك</p>
              {(searchQ || activeCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQ('');
                    setActiveCategory('all');
                  }}
                  className="px-5 py-2.5 rounded-full bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 font-bold hover:bg-[#D9A3AA]/10 transition-colors"
                >
                  عرض كل المنتجات
                </button>
              )}
            </div>
          ) : (
            visibleProducts.map((product, productIndex) => {
              const productQty = getProductQty(product.id);
              const canAddProduct = canAddProductToCart(product, productQty);
              const productAvailable = isProductAvailable(product);

              return (
              <div
                key={product.id}
                onClick={() => { if (productAvailable) navigate(`/store/products/${product.id}`); }}
                className={`art-product-card p-3 sm:p-4 lg:p-5 group flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500 ${productAvailable ? 'cursor-pointer' : 'opacity-80 cursor-not-allowed'}`}
                style={{ animationDelay: `${Math.min(productIndex % (columnCount * 2), 5) * 70}ms` }}
              >

                <div className={`art-product-media aspect-square rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center transition-transform duration-500 ${productAvailable ? 'group-hover:scale-105' : 'grayscale'}`}>
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

                  {!productAvailable && (
                    <div className="absolute top-3 left-3 z-20 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                      <AlertCircle size={12} /> نفدت الكمية
                    </div>
                  )}
                  <span className={`absolute bottom-2 right-2 z-20 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm border ${
                    productAvailable
                      ? 'bg-white/90 text-[#4A4A4A] border-[#D9A3AA]/20'
                      : 'bg-red-500 text-white border-red-400'
                  }`}>
                    {getStockLabel(product)}
                  </span>
                  {productAvailable && productQty > 0 && (
                    <span className="absolute top-2 right-2 bg-[#C5A059] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                      في السلة: {productQty}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col px-1">
                  <h3 className="font-black text-[#4A4A4A] text-sm md:text-base line-clamp-2 leading-snug mb-1">{product.name}</h3>
                  <p className="text-[#4A4A4A]/50 text-xs line-clamp-2 mb-4 flex-1">{product.description}</p>
                  <div className="mt-auto pt-3 border-t border-[#F8F5F2] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#D9A3AA] text-lg">{product.price} <span className="text-[10px] text-[#4A4A4A]/60">ر.س</span></span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      disabled={!canAddProduct}
                      className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-black ${
                        canAddProduct
                          ? 'bg-[#4A4A4A] text-white hover:bg-[#C5A059] shadow-md'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span>{productAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}</span>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center mt-2" aria-live="polite">
          {hasMoreProducts ? (
            <button
              type="button"
              onClick={() => {
                lastRevealAtRef.current = Date.now();
                revealNextProductRow();
              }}
              className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-[#4A4A4A]/60 transition-colors hover:bg-white hover:text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#D9A3AA]/40"
            >
              <ChevronDown size={16} className="text-[#D9A3AA]" />
              عرض المزيد
            </button>
          ) : filteredProducts.length > columnCount ? (
            <span className="text-xs font-bold text-[#4A4A4A]/35">تم عرض جميع المنتجات</span>
          ) : null}
        </div>
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
        initialMode="signup"
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
                <Link to="/store/orders" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#D9A3AA]/10 flex flex-col items-center justify-center gap-2 hover:border-[#D9A3AA]/40 transition-colors group">
                  <div className="w-12 h-12 bg-[#D9A3AA]/10 rounded-full flex items-center justify-center text-[#D9A3AA] group-hover:scale-110 transition-transform">
                    <Package size={22} />
                  </div>
                  <span className="font-bold text-sm text-[#4A4A4A]">طلباتي</span>
                </Link>
                <Link to="/store/orders" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#C5A059]/10 flex flex-col items-center justify-center gap-2 hover:border-[#C5A059]/40 transition-colors group">
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
                  <Link
                    to="/store/account"
                    onClick={() => setIsAccountSidebarOpen(false)}
                    className="w-full py-3 mt-2 bg-[#F8F5F2] text-[#4A4A4A] font-bold text-xs rounded-xl hover:bg-[#D9A3AA]/10 transition-colors border border-[#D9A3AA]/20 flex items-center justify-center gap-2"
                  >
                    <User size={15} className="text-[#C5A059]" /> إدارة الحساب
                  </Link>
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
                {getLocalizedCategoryLabel(selectedProduct.category, language)}
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
              <Link
                to={`/store/products/${selectedProduct.id}`}
                onClick={() => setIsModalOpen(false)}
                className="mb-8 flex w-full items-center justify-center rounded-xl border border-[#C5A059]/25 bg-white py-3 text-sm font-black text-[#4A4A4A] hover:border-[#C5A059]"
              >
                عرض صفحة المنتج والتفاصيل
              </Link>

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

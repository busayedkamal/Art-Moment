import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import RiyalSign from '../components/RiyalSign';

import {
  Search, MessageCircle, Image as ImageIcon, CheckCircle, Truck,
  Printer, Menu, X, ChevronDown, Lock, Star, Quote, BookOpen,
  Download, Share, PlusSquare, Sparkles, FileText,
  Plane, Gift, Smartphone, LayoutDashboard,
  MessageSquarePlus, Send, CreditCard, Award, Gem, Wallet,
  ShoppingBag, ArrowLeft, ShoppingCart, Plus, ShieldCheck, Scale
} from 'lucide-react';

import logo from '../assets/logo-art-moment.svg';
import fallbackLogo from '../assets/logo.png';
import instagramIcon from '../assets/instagram icon.svg';
import snapchatIcon from '../assets/SnapChat icon.svg';
import tiktokIcon from '../assets/tiktok icon.svg';
import linktreeIcon from '../assets/linktree_icon.svg';
import whatsappIcon from '../assets/whatsapp icon.svg';
import telegramIcon from '../assets/telegram icon.svg';
import gmailIcon from '../assets/gmail icon.svg';

const fromDb = (p) => ({
  id:         p.id,
  name:       p.name,
  description: p.description || '',
  price:      p.price,
  category:   p.category,
  image:      p.image       || null,
  hoverImage: p.hover_image || null,
  sortOrder:  p.sort_order  ?? 0,
  inStock:    p.in_stock    ?? true,
});

const CATEGORIES = [
  { id: 'all',      name: 'الكل' },
  { id: 'albums',   name: 'الألبومات' },
  { id: 'frames',   name: 'الإطارات' },
  { id: 'stickers', name: 'الملصقات' },
];

const FAQS = [
  { q: 'كم يستغرق تجهيز طلب الطباعة؟',   a: 'يعتمد الوقت على عدد الصور والضغط، لكن عادة يتم التجهيز في نفس اليوم أو اليوم التالي.' },
  { q: 'كيف أعرف أين وصل طلبي؟',          a: 'من خلال صفحة "تتبع الطلب" في الموقع. تحتاج فقط لرقم الطلب الذي نرسله لك.' },
  { q: 'ما هي طرق الدفع المتاحة؟',         a: 'الدفع يكون غالباً عند الاستلام نقداً أو تحويل بنكي.' },
  { q: 'كم يستغرق التوصيل؟',               a: 'يستغرق التوصيل داخل الأحساء 24-48 ساعة، وخارجها من 3 إلى 5 أيام عمل.' },
  { q: 'هل منتجات المتجر أصلية ومضمونة؟', a: 'نعم، جميع الألبومات والإطارات مختارة بعناية ومضمونة الجودة من لحظة فن.' },
];

const REVIEWS = [
  { id: 1, name: 'زينب',   comment: 'الجودة خرافية والألوان تفتح النفس! التغليف كان ممتاز جداً.',   rating: 5 },
  { id: 2, name: 'معصومة', comment: 'تعامل راقي وسرعة في الإنجاز. طلبت الصباح واستلمت العصر.',     rating: 5 },
  { id: 3, name: 'فاطمة',  comment: 'أفضل محل طباعة تعاملت معه في الأحساء، دقة في المواعيد.',       rating: 4 },
];

export default function StoreIndex() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleAdminClick = (e) => {
    e.preventDefault();
    navigate(session ? '/app/dashboard' : '/admin/login');
  };

  // --- Store states ---
  const [products, setProducts]               = useState([]);
  const [searchQ, setSearchQ]                 = useState('');
  const [activeCategory, setActiveCategory]   = useState('all');
  const [cart, setCart]                       = useState([]);
  const [toastMsg, setToastMsg]               = useState('');
  const [openPolicyModal, setOpenPolicyModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // --- UI states ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq]                   = useState(null);
  const [activePackage, setActivePackage]       = useState(0);
  const [scrolled, setScrolled]                 = useState(false);

  // --- PWA states ---
  const [deferredPrompt, setDeferredPrompt]             = useState(null);
  const [isInstallable, setIsInstallable]               = useState(false);
  const [isIOS, setIsIOS]                               = useState(false);
  const [showIOSInstructions, setShowIOSInstructions]   = useState(false);

  // --- Pricing states ---
  const [pricingSettings, setPricingSettings] = useState(null);
  const [calcQty, setCalcQty]                 = useState(50);

  // --- Feedback states ---
  const [feedbackType, setFeedbackType] = useState('تقييم ⭐️');
  const [feedbackText, setFeedbackText] = useState('');

  // --- Accordion state ---
  const [activeExpandable, setActiveExpandable] = useState(null);
  const toggleExpandable = (section) => setActiveExpandable(prev => prev === section ? null : section);

  // ─── Effects ───────────────────────────────────────────────
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
        setProducts([]);
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
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (data) setPricingSettings(data);
      } catch (err) { console.error('Error fetching settings:', err); }
    };
    fetchSettings();
  }, []);

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

  // ─── Store logic ────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchCat    = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`تم إضافة ${product.name} للسلة 🛍️`);
  };

  const getProductQty = (id) => cart.find(item => item.id === id)?.qty || 0;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const getRelatedProducts = (currentProduct) => {
    if (!currentProduct) return [];
    return products
      .filter(p => p.id !== currentProduct.id && p.category !== currentProduct.category && p.inStock)
      .slice(0, 4);
  };

  // ─── PWA logic ──────────────────────────────────────────────
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    }
  };

  // ─── Pricing logic ───────────────────────────────────────────
  const calculateDynamicPrice = (qty) => {
    if (!pricingSettings) return { unit: 0, total: 0, savings: 0 };
    let unitPrice = pricingSettings.tier_1_price;
    const basePrice = pricingSettings.tier_1_price;
    if (qty > pricingSettings.tier_2_limit)      unitPrice = pricingSettings.tier_3_price;
    else if (qty > pricingSettings.tier_1_limit) unitPrice = pricingSettings.tier_2_price;
    const total   = qty * unitPrice;
    const savings = qty * basePrice - total;
    return { unit: unitPrice, total, savings };
  };
  const calcResult = calculateDynamicPrice(calcQty);

  // ─── Feedback logic ──────────────────────────────────────────
  const handleSendFeedback = () => {
    if (!feedbackText.trim()) return;
    const msg = `مرحباً، لدي رسالة للإدارة:\n\n*نوع الرسالة:* ${feedbackType}\n*النص:* ${feedbackText}`;
    window.open(`https://wa.me/966569663697?text=${encodeURIComponent(msg)}`, '_blank');
    setFeedbackText('');
  };

  // ─── Packages data ───────────────────────────────────────────
  const packages = [
    {
      id: 0, icon: Plane, title: 'ذكريات السفر',
      desc: 'لا تخلي صور السفرة محبوسة بالجوال! وثق أجمل أيامك في ألبوم يجمع كل تفاصيلها لتعيشها كل ما فتحته.',
      contents: ['ألبوم صور أنيق ومقاوم', '100 صورة مقاس 4x6', 'ألوان زاهية وتفاصيل دقيقة'],
      color: 'from-blue-500 to-cyan-400',
      msg: 'مرحباً، مهتم بطلب "باقة ذكريات السفر" (ألبوم + 100 صورة)',
    },
    {
      id: 1, icon: Gift, title: 'الهدية المثالية',
      desc: 'أجمل هدية ممكن تقدمها لشخص غالي هي ذكرياتكم المشتركة. جهزناها لك بعناية لتكون مفاجأة لا تُنسى.',
      contents: ['ألبوم فاخر لحفظ الصور', '50 صورة لأجمل لحظاتكم', 'تغليف هدايا فاخر + كرت إهداء'],
      color: 'from-[#D9A3AA] to-pink-500',
      msg: 'مرحباً، مهتم بطلب "باقة الهدية المثالية" (مع التغليف)',
    },
    {
      id: 2, icon: Smartphone, title: 'تفريغ زحمة الجوال',
      desc: 'الجوالات تخرب وتضيع، لكن الصور المطبوعة تعيش للأبد. نظف مساحة جوالك واحفظ ذكرياتك بأمان.',
      contents: ['200 صورة مقاس 4x6', 'طباعة عالية الجودة تدوم طويلاً', 'توفير ممتاز للكميات'],
      color: 'from-[#C5A059] to-amber-600',
      msg: 'مرحباً، مهتم بطلب "باقة تفريغ الجوال" (200 صورة)',
    },
    {
      id: 3, icon: LayoutDashboard, title: 'جدار الذكريات',
      desc: 'جدد غرفتك أو مكتبك بصورك المفضلة! صور بحجم كبير تناسب البراويز وتضيف روح للمكان.',
      contents: ['6 صور كبيرة مقاس A4', 'دقة استثنائية تناسب البراويز', 'جاهزة للتعليق فوراً'],
      color: 'from-emerald-500 to-teal-400',
      msg: 'مرحباً، مهتم بطلب "باقة جدار الذكريات" (6 صور A4)',
    },
  ];
  const activePkg = packages[activePackage];

  return (
    <div className="min-h-screen bg-[#F8F5F2] font-sans text-[#4A4A4A] relative overflow-x-hidden selection:bg-[#D9A3AA] selection:text-white" dir="rtl">

      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#D9A3AA]/5 rounded-full blur-3xl opacity-60 mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50rem] h-[50rem] bg-[#C5A059]/5 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#C5A059] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle size={18} /> {toastMsg}
        </div>
      )}

      {/* iOS PWA instructions modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#F8F5F2] w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 left-4 text-[#4A4A4A] hover:text-[#C5A059]"><X size={24} /></button>
            <div className="text-center mb-6">
              <img src={logo} alt="App Icon" className="w-16 h-16 mx-auto mb-2 object-contain" />
              <h3 className="text-xl font-black text-[#4A4A4A]">تثبيت تطبيق لحظة فن</h3>
            </div>
            <div className="space-y-4 text-sm font-medium text-[#4A4A4A]">
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><Share size={20} className="text-[#C5A059]" /> <span>1. اضغط زر "مشاركة"</span></div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><PlusSquare size={20} className="text-[#C5A059]" /> <span>2. اختر "إضافة للشاشة الرئيسية"</span></div>
            </div>
            <button onClick={() => setShowIOSInstructions(false)} className="w-full mt-6 bg-[#D9A3AA] text-white py-3 rounded-xl font-bold hover:bg-[#C5A059] transition-colors">فهمت ذلك</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          NAVBAR
      ══════════════════════════════════ */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F8F5F2]/90 backdrop-blur-md shadow-sm border-b border-[#D9A3AA]/10' : 'bg-transparent'}`}>
        <div className="w-[96%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

          {/* Right Side: Mobile Menu + Logo */}
          <div className="flex items-center gap-1 sm:gap-3">
            <button className="md:hidden p-1 -mr-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logo} alt="Art Moment Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-xl font-black text-[#4A4A4A] leading-none">لحظة فن</h1>
                <span className="text-[9px] sm:text-[10px] text-[#C5A059] font-bold tracking-widest uppercase">Art Moment</span>
              </div>
            </div>
          </div>

          {/* Center: Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-[#4A4A4A]/80">
            <a href="#products" className="hover:text-[#D9A3AA] transition-colors flex items-center gap-1.5">
              <ShoppingBag size={15} className="text-[#D9A3AA]" /> المتجر
            </a>
            <a href="#services" className="hover:text-[#D9A3AA] transition-colors">الباقات</a>
            <a href="#services" className="hover:text-[#D9A3AA] transition-colors">الطباعة</a>
            <a href="#services" className="hover:text-[#D9A3AA] transition-colors flex items-center gap-1.5">
              <Wallet size={15} className="text-[#C5A059]" /> شحن المحفظة
            </a>
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
          </nav>

          {/* Left Side: Icons */}
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

            <button onClick={handleAdminClick} className="hidden sm:inline-flex bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 px-3 py-2 rounded-full hover:text-[#D9A3AA] transition-all shadow-sm">
              <Lock size={16} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#F8F5F2] border-t border-[#D9A3AA]/10 p-4 space-y-3 shadow-xl absolute w-full z-50">
            <a href="#products" className="flex items-center gap-2 py-2 text-[#D9A3AA] font-bold" onClick={() => setIsMobileMenuOpen(false)}><ShoppingBag size={16} /> المتجر</a>
            <a href="#services" className="block py-2 text-[#4A4A4A] font-bold" onClick={() => setIsMobileMenuOpen(false)}>الباقات</a>
            <a href="#services" className="block py-2 text-[#4A4A4A]"           onClick={() => setIsMobileMenuOpen(false)}>خدمات الطباعة</a>
            <a href="#services" className="flex items-center gap-2 py-2 text-[#C5A059] font-bold" onClick={() => setIsMobileMenuOpen(false)}><Wallet size={16} /> شحن المحفظة</a>
            <Link to="/track" className="block w-full text-center py-3 bg-white rounded-xl font-bold text-[#4A4A4A] border border-[#D9A3AA]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>تتبع طلبك</Link>
            <button onClick={(e) => { setIsMobileMenuOpen(false); handleAdminClick(e); }}
              className="w-full text-center py-3 rounded-xl font-bold text-[#4A4A4A]/60 hover:bg-white hover:text-[#D9A3AA] transition-all flex items-center justify-center gap-2">
              <Lock size={16} /> دخول المسؤول
            </button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════
          1. HERO SECTION (Banner Style)
      ══════════════════════════════════ */}
      <section className="pt-6 pb-8 w-[96%] max-w-[1600px] mx-auto px-4">
        <div className="relative bg-[#4A4A4A] rounded-[2.5rem] overflow-hidden p-8 md:py-12 shadow-xl border-[4px] border-white/60 flex justify-center text-center text-white">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[#D9A3AA]/20 blur-3xl rounded-full translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-1/3 h-full bg-[#C5A059]/20 blur-3xl rounded-full -translate-x-1/2 pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D9A3AA]/20 text-[#D9A3AA] text-[10px] sm:text-xs font-bold border border-[#D9A3AA]/30 mx-auto shadow-sm">
              <Sparkles size={14} className="text-[#C5A059]" /> طباعة صور فوتوغرافية في الأحساء
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight md:leading-tight">
              اطبع أجمل <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D9A3AA] to-[#C5A059]">لحظاتك</span> لتبقى للأبد.
            </h1>

            <p className="text-sm md:text-base text-white/70 leading-relaxed mx-auto max-w-lg">
              حوّل صورك الرقمية إلى ذكريات ملموسة بجودة استثنائية.
              أرسل صورك، تابع الطلب، واستلمها بتغليف فاخر.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
              <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#25D366]/40">
                <MessageCircle size={20} /> واتساب
              </a>
              <Link to="/track" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white/10 border border-white/20 text-white font-bold hover:bg-white/20 flex items-center justify-center gap-2 transition-colors">
                <Search size={20} className="text-[#C5A059]" /> تتبع طلبك
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap gap-4 justify-center text-[10px] sm:text-xs font-bold text-white/60">
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> ورق فاخر</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> دقة عالية</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> دفع عند الاستلام</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          2. STORE PRODUCTS GRID
      ══════════════════════════════════ */}
      <main id="products" className="max-w-7xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D9A3AA]/10 text-[#D9A3AA] font-bold text-xs mb-4 border border-[#D9A3AA]/20">
            <ShoppingBag size={15} /> متجرنا
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-[#4A4A4A] mb-3">تشكيلتنا <span className="text-[#D9A3AA]">الفنية</span></h2>
          <p className="text-[#4A4A4A]/60 max-w-xl mx-auto">ألبومات وإطارات وملصقات مختارة بعناية لتكمل جمال صورك المطبوعة</p>
        </div>

        {/* Category filter chips */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-8 justify-start md:justify-center">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? 'bg-[#D9A3AA] text-white border-[#D9A3AA] shadow-md'
                  : 'bg-white text-[#4A4A4A] border-[#D9A3AA]/20 hover:border-[#D9A3AA]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-8 relative max-w-md mx-auto">
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="ابحثي عن المنتجات..."
            className="w-full bg-white border border-[#D9A3AA]/20 rounded-xl px-4 py-3 pr-10 outline-none focus:border-[#D9A3AA] shadow-sm"
          />
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
          {searchQ && (
            <X size={16} onClick={() => setSearchQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer text-red-400" />
          )}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[#4A4A4A]/50 font-bold">لا توجد منتجات مطابقة لبحثك</div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-3xl p-4 border border-[#D9A3AA]/10 shadow-sm hover:shadow-lg transition-all group flex flex-col relative overflow-hidden">
                <div
                  onClick={() => product.inStock && setSelectedProduct(product)}
                  className={`aspect-square bg-[#F8F5F2] rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center transition-transform duration-500 ${product.inStock ? 'cursor-pointer group-hover:scale-105' : 'opacity-70 grayscale'}`}
                >
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
                  {getProductQty(product.id) > 0 && (
                    <span className="absolute top-2 right-2 bg-[#C5A059] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                      في السلة: {getProductQty(product.id)}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <h3 className="font-black text-[#4A4A4A] text-sm md:text-base line-clamp-2 leading-snug mb-1">{product.name}</h3>
                  <p className="text-[#4A4A4A]/50 text-xs line-clamp-2 mb-3 flex-1">{product.description}</p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F8F5F2]">
                    <span className="font-black text-[#D9A3AA]">{product.price} <span className="text-[10px]">ر.س</span></span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!product.inStock}
                      className={`p-2 rounded-xl transition-all ${product.inStock ? 'bg-[#4A4A4A] text-white hover:bg-[#D9A3AA] hover:scale-110' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart CTA — shown only when cart has items */}
        {cartCount > 0 && (
          <div className="mt-10 text-center">
            <Link to="/store/cart" className="inline-flex items-center gap-3 bg-[#4A4A4A] text-white px-8 py-4 rounded-2xl font-black hover:bg-[#D9A3AA] transition-all shadow-lg hover:-translate-y-1">
              <ShoppingCart size={20} /> عرض السلة ({cartCount} منتج) <ArrowLeft size={18} />
            </Link>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════
          3. EXPANDABLE SERVICES ACCORDION
      ══════════════════════════════════ */}
      <section id="services" className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-black text-center mb-6 text-[#4A4A4A]">اكتشف خدماتنا</h2>
        <div className="space-y-3">

          {/* WALLET PACKAGES */}
          <div className="rounded-2xl border border-[#D9A3AA]/15 overflow-hidden shadow-sm">
            <button onClick={() => toggleExpandable('wallet')} className="w-full flex justify-between items-center p-5 text-right bg-white hover:bg-[#F8F5F2] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C5A059]/10 rounded-xl flex items-center justify-center text-[#C5A059]"><Wallet size={20} /></div>
                <div>
                  <div className="font-black text-[#4A4A4A]">شحن المحفظة</div>
                  <div className="text-xs text-[#4A4A4A]/50">باقات برونزية وفضية وذهبية</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-[#D9A3AA] transition-transform duration-300 ${activeExpandable === 'wallet' ? 'rotate-180' : ''}`} />
            </button>
            {activeExpandable === 'wallet' && (
              <div className="bg-[#F8F5F2] border-t border-[#D9A3AA]/10">
                <div className="py-10 px-4">
                  <div className="text-center mb-10 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] font-bold text-xs mb-4 border border-[#C5A059]/20">
                      <Wallet size={16} /> رصيد ذكرياتك.. يعطيك أكثر!
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-[#4A4A4A] mb-3 leading-tight">اشحن محفظتك، <span className="text-[#C5A059]">واطبع براحتك</span></h3>
                    <p className="text-[#4A4A4A]/70 text-sm leading-relaxed mb-4">بدل ما تنتظر العروض، اشحن محفظتك في <span className="font-bold text-[#D9A3AA]">لحظة فن</span> واحصل على رصيد إضافي تستخدمه بكل حرية.</p>
                    <div className="flex flex-wrap justify-center gap-3 text-xs font-bold text-[#4A4A4A]/80">
                      <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-[#D9A3AA]/10"><CheckCircle size={14} className="text-emerald-500" /> الرصيد لا ينتهي صلاحيته</span>
                      <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-[#D9A3AA]/10"><CheckCircle size={14} className="text-emerald-500" /> تقسم طلباتك براحتك</span>
                      <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-[#D9A3AA]/10"><CheckCircle size={14} className="text-emerald-500" /> هدايا وميزات حصرية</span>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <div className="bg-white rounded-[2rem] p-8 border border-orange-200/50 hover:shadow-xl transition-all flex flex-col relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-orange-400 to-orange-200"></div>
                      <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform"><CreditCard size={28} /></div>
                      <h3 className="text-xl font-black text-[#4A4A4A] mb-2">الباقة البرونزية</h3>
                      <div className="mb-6"><span className="text-3xl font-black text-orange-600">299</span> <RiyalSign size="0.7em" /></div>
                      <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-100">
                        <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">يصير رصيدك في المحفظة:</span>
                        <span className="text-2xl font-black text-[#4A4A4A]">333 <RiyalSign size="0.7em" /></span>
                      </div>
                      <p className="text-sm text-[#4A4A4A]/70 mb-8 flex-1 leading-relaxed">المبلغ الإضافي يطبع لك أكثر من 30 صورة مجانية.. أو 6 صور A4!</p>
                      <a href="https://wa.me/966569663697?text=مرحباً، أرغب بشحن الباقة البرونزية بـ 299 ريال" target="_blank" rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-orange-100 text-orange-700 font-bold hover:bg-orange-600 hover:text-white transition-colors flex justify-center items-center gap-2">اشحن الآن</a>
                    </div>
                    <div className="bg-white rounded-[2rem] p-8 border-2 border-slate-300 shadow-xl flex flex-col relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-l from-slate-400 to-slate-200"></div>
                      <div className="absolute top-4 left-4 bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full border border-slate-200">الأكثر طلباً</div>
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 mb-6 group-hover:scale-110 transition-transform"><Award size={28} /></div>
                      <h3 className="text-xl font-black text-[#4A4A4A] mb-2">الباقة الفضية</h3>
                      <div className="mb-6"><span className="text-4xl font-black text-slate-600">699</span> <RiyalSign size="0.7em" /></div>
                      <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                        <span className="block text-[10px] text-slate-500 font-bold mb-1">يصير رصيدك في المحفظة:</span>
                        <span className="text-3xl font-black text-slate-700">808 <RiyalSign size="0.7em" /></span>
                      </div>
                      <p className="text-sm text-[#4A4A4A]/70 mb-8 flex-1 leading-relaxed">المبلغ الإضافي يغطي لك قيمة ألبوم فاخر أو صندوق هدايا متكامل لأحبابك!</p>
                      <a href="https://wa.me/966569663697?text=مرحباً، أرغب بشحن الباقة الفضية بـ 699 ريال" target="_blank" rel="noreferrer"
                        className="w-full py-4 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 shadow-md">اشحن الآن</a>
                    </div>
                    <div className="bg-white rounded-[2rem] p-8 border border-amber-200/50 hover:shadow-xl transition-all flex flex-col relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-amber-400 to-amber-200"></div>
                      <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform"><Gem size={28} /></div>
                      <h3 className="text-xl font-black text-[#4A4A4A] mb-2">الباقة الذهبية</h3>
                      <div className="mb-6"><span className="text-3xl font-black text-amber-600">999</span> <RiyalSign size="0.7em" /></div>
                      <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-100">
                        <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">يصير رصيدك في المحفظة:</span>
                        <span className="text-2xl font-black text-[#4A4A4A]">1,202 <RiyalSign size="0.7em" /></span>
                      </div>
                      <p className="text-sm text-[#4A4A4A]/70 mb-8 flex-1 leading-relaxed">رصيد يوثق مناسباتك لسنة كاملة، مع أولوية في التنفيذ وتوصيل مجاني!</p>
                      <a href="https://wa.me/966569663697?text=مرحباً، أرغب بشحن الباقة الذهبية بـ 999 ريال" target="_blank" rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-amber-100 text-amber-700 font-bold hover:bg-amber-500 hover:text-white transition-colors flex justify-center items-center gap-2">اشحن الآن</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MEMORY PACKAGES */}
          <div className="rounded-2xl border border-[#D9A3AA]/15 overflow-hidden shadow-sm">
            <button onClick={() => toggleExpandable('packages')} className="w-full flex justify-between items-center p-5 text-right bg-white hover:bg-[#F8F5F2] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D9A3AA]/10 rounded-xl flex items-center justify-center text-[#D9A3AA]"><Gift size={20} /></div>
                <div>
                  <div className="font-black text-[#4A4A4A]">باقات الذكريات</div>
                  <div className="text-xs text-[#4A4A4A]/50">رحلة، هدية، صور هاتف، معرض جداري</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-[#D9A3AA] transition-transform duration-300 ${activeExpandable === 'packages' ? 'rotate-180' : ''}`} />
            </button>
            {activeExpandable === 'packages' && (
              <div className="bg-[#4A4A4A] text-white border-t border-white/10 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-64 h-64 bg-[#D9A3AA]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#C5A059]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
                <div className="max-w-6xl mx-auto px-4 py-10 relative z-10">
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C5A059]/20 text-[#C5A059] font-bold text-xs mb-3 border border-[#C5A059]/30">
                      <Sparkles size={14} /> حلك الجاهز عندنا
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black leading-tight mb-3">
                      محتار وش تطبع؟ <br /><span className="text-[#C5A059]">اختر المناسبة وخلي الباقي علينا!</span>
                    </h3>
                    <p className="text-white/70 max-w-xl mx-auto text-sm">صممنا لك باقات ذكية ومدروسة توفر عليك التفكير، وتضمن لك توثيق ذكرياتك بأفضل شكل وبأنسب سعر.</p>
                  </div>
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-4 space-y-3">
                      {packages.map((pkg) => (
                        <button key={pkg.id} onClick={() => setActivePackage(pkg.id)}
                          className={`w-full text-right p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 border ${activePackage === pkg.id ? 'bg-white text-[#4A4A4A] border-white shadow-xl scale-105' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${pkg.color} shadow-md`}>
                            <pkg.icon size={24} />
                          </div>
                          <h4 className={`font-black ${activePackage === pkg.id ? 'text-[#4A4A4A]' : 'text-white'}`}>{pkg.title}</h4>
                        </button>
                      ))}
                    </div>
                    <div className="md:col-span-8">
                      <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden" key={activePkg.id}>
                        <div className={`absolute top-0 right-0 w-2 h-full bg-gradient-to-b ${activePkg.color}`}></div>
                        <h3 className="text-3xl font-black text-white mb-4">{activePkg.title}</h3>
                        <p className="text-white/70 leading-relaxed mb-8">{activePkg.desc}</p>
                        <div className="bg-[#F8F5F2]/10 rounded-2xl p-6 mb-8 border border-white/5">
                          <h4 className="font-bold text-[#C5A059] mb-4 text-sm uppercase tracking-wider">محتويات الباقة الافتراضية:</h4>
                          <ul className="space-y-3">
                            {activePkg.contents.map((item, idx) => (
                              <li key={idx} className="flex items-center gap-3 text-white/90">
                                <CheckCircle size={18} className="text-[#D9A3AA]" />
                                <span className="font-medium">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <a href={`https://wa.me/966569663697?text=${encodeURIComponent(activePkg.msg)}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-[#4A4A4A] font-black hover:bg-[#F8F5F2] hover:scale-105 transition-all shadow-xl">
                          <MessageCircle size={20} /> اطلب هذه الباقة الآن
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PRINT SERVICES */}
          <div className="rounded-2xl border border-[#D9A3AA]/15 overflow-hidden shadow-sm">
            <button onClick={() => toggleExpandable('print')} className="w-full flex justify-between items-center p-5 text-right bg-white hover:bg-[#F8F5F2] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#4A4A4A]/10 rounded-xl flex items-center justify-center text-[#4A4A4A]"><Printer size={20} /></div>
                <div>
                  <div className="font-black text-[#4A4A4A]">خدمات الطباعة</div>
                  <div className="text-xs text-[#4A4A4A]/50">صور 4×6، A4، ألبومات — مع حاسبة السعر</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-[#D9A3AA] transition-transform duration-300 ${activeExpandable === 'print' ? 'rotate-180' : ''}`} />
            </button>
            {activeExpandable === 'print' && (
              <div className="bg-white border-t border-[#D9A3AA]/10">
                <div className="py-10 px-4 max-w-7xl mx-auto">
                  <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
                    {[
                      { icon: ImageIcon, title: 'صور 4×6', desc: 'المقاس الأشهر والأكثر طلباً. مثالي لحفظ يومياتك وتوثيق اللحظات العفوية والرحلات.', features: ['ورق تصوير فاخر مقاوم للبهتان', 'ألوان زاهية وواقعية تدوم طويلاً', 'المقاس المثالي للألبومات الكلاسيكية'], color: 'text-[#D9A3AA]', bg: 'bg-[#D9A3AA]/10' },
                      { icon: FileText, title: 'صور A4', desc: 'لصورك الاحترافية واللوحات الفنية. المقاس الأفضل لإبراز أدق التفاصيل وتزيين المكان.', features: ['دقة طباعة استثنائية للتفاصيل', 'حجم كبير مناسب للبراويز الجدارية', 'مثالية لصور التخرج والمناسبات الكبرى'], color: 'text-[#C5A059]', bg: 'bg-[#C5A059]/10' },
                      { icon: BookOpen, title: 'الألبومات', desc: 'لا تترك صورك متناثرة. اختر من تشكيلتنا الأنيقة لحفظ ذكرياتك بطريقة فخمة ومرتبة.', features: ['تصاميم عصرية وأغلفة متينة', 'سعات مختلفة تناسب كمية صورك', 'حماية تامة للصور من الغبار والتلف'], color: 'text-[#4A4A4A]', bg: 'bg-[#4A4A4A]/10' },
                    ].map((service, i) => (
                      <div key={i} className="bg-[#F8F5F2] rounded-3xl p-8 hover:shadow-xl hover:shadow-[#D9A3AA]/10 transition-all border border-transparent hover:border-[#D9A3AA]/30 group flex flex-col">
                        <div className={`w-14 h-14 ${service.bg} rounded-2xl flex items-center justify-center ${service.color} mb-6 group-hover:scale-110 transition-transform`}>
                          <service.icon size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-[#4A4A4A] mb-3">{service.title}</h3>
                        <p className="text-[#4A4A4A]/60 text-sm leading-relaxed mb-6 flex-1">{service.desc}</p>
                        <ul className="space-y-3 pt-4 border-t border-[#D9A3AA]/10">
                          {service.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#4A4A4A]/80 font-medium">
                              <CheckCircle size={16} className={`shrink-0 mt-0.5 ${service.color}`} />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {pricingSettings?.is_dynamic_pricing_enabled && (
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-[#4A4A4A] rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                          <div className="flex-1 text-center md:text-right">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A3AA]/20 text-[#D9A3AA] font-bold text-xs mb-3 border border-[#D9A3AA]/30">
                              <Sparkles size={14} className="animate-pulse" /> وفر أكثر
                            </div>
                            <h3 className="text-3xl font-black mb-4">كل ما طبعت أكثر، <span className="text-[#C5A059]">وفرت أكثر!</span></h3>
                            <p className="text-white/70 text-sm mb-8">حرك المؤشر وشوف السعر يتغير تلقائياً.</p>
                            <div className="space-y-6">
                              <input type="range" min="1" max="100" value={calcQty} onChange={e => setCalcQty(Number(e.target.value))}
                                className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#D9A3AA]" />
                              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                                <span className="text-sm font-bold text-white/80">العدد المختار:</span>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => setCalcQty(Math.max(1, calcQty - 1))} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">-</button>
                                  <span className="text-2xl font-black w-12 text-center text-[#C5A059]">{calcQty}</span>
                                  <button onClick={() => setCalcQty(calcQty + 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">+</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="w-full md:w-80 bg-white text-[#4A4A4A] rounded-3xl p-8 shadow-2xl transform md:rotate-2">
                            <div className="text-center pb-6 border-b border-[#F8F5F2] mb-6">
                              <span className="text-xs text-[#4A4A4A]/50 font-bold uppercase tracking-wider block mb-1">سعر الصورة الواحدة</span>
                              <span className="text-5xl font-black text-[#D9A3AA]">{calcResult.unit} <RiyalSign size="0.55em" /></span>
                            </div>
                            <div className="space-y-4 mb-8">
                              <div className="flex justify-between text-sm font-bold">
                                <span className="text-[#4A4A4A]/60">الإجمالي</span>
                                <span>{calcResult.total.toFixed(2)} <RiyalSign /></span>
                              </div>
                              {calcResult.savings > 0 && (
                                <div className="flex justify-between text-sm font-bold text-[#C5A059] bg-[#C5A059]/10 px-4 py-2 rounded-xl">
                                  <span className="flex items-center gap-1"><Sparkles size={14} /> وفرتي</span>
                                  <span>{calcResult.savings.toFixed(2)} <RiyalSign /></span>
                                </div>
                              )}
                            </div>
                            <a href={`https://wa.me/966569663697?text=${encodeURIComponent(`مرحباً، أرغب بطباعة ${calcQty} صورة`)}`}
                              target="_blank" rel="noreferrer"
                              className="block w-full bg-[#4A4A4A] text-white text-center py-4 rounded-xl font-bold hover:bg-[#C5A059] transition-colors shadow-lg">اطلبي بهذا السعر</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* REVIEWS + FEEDBACK */}
          <div className="rounded-2xl border border-[#D9A3AA]/15 overflow-hidden shadow-sm">
            <button onClick={() => toggleExpandable('reviews')} className="w-full flex justify-between items-center p-5 text-right bg-white hover:bg-[#F8F5F2] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C5A059]/10 rounded-xl flex items-center justify-center text-[#C5A059]"><Star size={20} /></div>
                <div>
                  <div className="font-black text-[#4A4A4A]">آراء العملاء وتواصل معنا</div>
                  <div className="text-xs text-[#4A4A4A]/50">تقييمات حقيقية + أرسل ملاحظاتك للإدارة</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-[#D9A3AA] transition-transform duration-300 ${activeExpandable === 'reviews' ? 'rotate-180' : ''}`} />
            </button>
            {activeExpandable === 'reviews' && (
              <div className="bg-[#F8F5F2] border-t border-[#D9A3AA]/10">
                <div className="py-10 px-4 max-w-7xl mx-auto">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-black text-[#4A4A4A] mb-3">ماذا يقول <span className="text-[#D9A3AA]">عملاؤنا؟</span></h3>
                    <div className="flex justify-center gap-1 mb-8 text-[#C5A059]">
                      {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 mb-10">
                      {REVIEWS.map(review => (
                        <div key={review.id} className="bg-white p-8 rounded-[2rem] border border-[#D9A3AA]/10 relative hover:-translate-y-2 transition-transform duration-300 shadow-sm">
                          <Quote className="absolute top-6 left-6 text-[#F8F5F2]" size={40} />
                          <p className="text-[#4A4A4A]/80 font-medium leading-relaxed mb-6 relative z-10">"{review.comment}"</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] rounded-full flex items-center justify-center text-white font-bold">{review.name.charAt(0)}</div>
                            <div className="text-right">
                              <div className="font-bold text-[#4A4A4A]">{review.name}</div>
                              <div className="text-xs text-[#D9A3AA]">عميل موثوق ✅</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-8 shadow-xl border border-[#D9A3AA]/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-[#D9A3AA] to-[#C5A059]"></div>
                      <h3 className="text-xl font-black text-[#4A4A4A] flex items-center justify-center gap-2 mb-2"><MessageSquarePlus className="text-[#C5A059]" /> الإدارة في خدمتك دائماً</h3>
                      <p className="text-[#4A4A4A]/60 text-sm mb-6 text-center">نستقبل تقييماتك، مقترحاتك، أو حتى شكواك بصدر رحب.</p>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3 justify-center">
                          {['تقييم ⭐️', 'اقتراح 💡', 'شكوى ⚠️'].map(type => (
                            <button key={type} onClick={() => setFeedbackType(type)}
                              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${feedbackType === type ? 'bg-[#4A4A4A] text-white border-[#4A4A4A] shadow-md scale-105' : 'bg-white text-[#4A4A4A]/60 border-[#D9A3AA]/30 hover:border-[#4A4A4A]/50 hover:bg-[#F8F5F2]'}`}
                            >{type}</button>
                          ))}
                        </div>
                        <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                          placeholder="اكتب رسالتك هنا بكل شفافية وسرية تامة..."
                          className="w-full h-32 bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl p-4 text-[#4A4A4A] outline-none focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 resize-none transition-all" />
                        <button onClick={handleSendFeedback} disabled={!feedbackText.trim()}
                          className="w-full bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white py-4 rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                          <Send size={18} /> إرسال الرسالة للإدارة
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FAQ */}
          <div className="rounded-2xl border border-[#D9A3AA]/15 overflow-hidden shadow-sm">
            <button onClick={() => toggleExpandable('faq')} className="w-full flex justify-between items-center p-5 text-right bg-white hover:bg-[#F8F5F2] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D9A3AA]/10 rounded-xl flex items-center justify-center text-[#D9A3AA]"><MessageCircle size={20} /></div>
                <div>
                  <div className="font-black text-[#4A4A4A]">الأسئلة الشائعة</div>
                  <div className="text-xs text-[#4A4A4A]/50">إجابات على أكثر الأسئلة المطروحة</div>
                </div>
              </div>
              <ChevronDown size={20} className={`text-[#D9A3AA] transition-transform duration-300 ${activeExpandable === 'faq' ? 'rotate-180' : ''}`} />
            </button>
            {activeExpandable === 'faq' && (
              <div className="bg-[#F8F5F2] border-t border-[#D9A3AA]/10">
                <div className="py-8 px-4 max-w-2xl mx-auto space-y-3">
                  {FAQS.map((faq, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-[#D9A3AA]/15 overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full flex justify-between items-center p-5 text-right">
                        <span className="font-bold text-[#4A4A4A] text-sm">{faq.q}</span>
                        <ChevronDown size={18} className={`text-[#D9A3AA] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                      </button>
                      {openFaq === idx && (
                        <div className="p-5 pt-0 text-sm text-[#4A4A4A]/70 leading-relaxed border-t border-[#F8F5F2]">{faq.a}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════
          8. TRUST & COMPLIANCE
      ══════════════════════════════════ */}
      <section className="bg-[#4A4A4A] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <ShieldCheck size={40} className="text-[#D9A3AA] mb-4" />
            <h3 className="font-black text-lg mb-2">تسوق آمن وموثق</h3>
            <p className="text-sm text-white/70">متجر موثق في المركز السعودي للأعمال، لضمان حقوقك وتجربة تسوق موثوقة.</p>
          </div>
          <div className="flex flex-col items-center">
            <Scale size={40} className="text-[#C5A059] mb-4" />
            <h3 className="font-black text-lg mb-2">سياسة استرجاع عادلة</h3>
            <p className="text-sm text-white/70">حق الاسترجاع مكفول خلال 7 أيام للمنتجات الجاهزة بحالتها الأصلية.</p>
          </div>
          <div className="flex flex-col items-center">
            <Truck size={40} className="text-[#D9A3AA] mb-4" />
            <h3 className="font-black text-lg mb-2">ضمان التوصيل</h3>
            <p className="text-sm text-white/70">نلتزم بتوصيل طلباتك بأسرع وقت، مع ضمان التسليم خلال المدة النظامية.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          9. PROFESSIONAL FOOTER
      ══════════════════════════════════ */}
      <footer className="bg-white border-t border-[#D9A3AA]/20 pt-16 pb-8">
        <div className="w-[96%] max-w-[1600px] mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="لحظة فن" className="w-10 h-10 object-contain grayscale opacity-80" />
              <h2 className="text-xl font-black text-[#4A4A4A]">لحظة فن</h2>
            </div>
            <p className="text-sm text-[#4A4A4A]/70 leading-relaxed mb-6">نوثق أجمل لحظاتك بأعلى جودة. تشكيلة من الألبومات والإطارات الفاخرة التي تليق بذكرياتك.</p>
            <div className="flex items-center gap-2 bg-[#F8F5F2] w-max px-4 py-2 rounded-xl border border-[#D9A3AA]/20">
              <ShieldCheck size={18} className="text-emerald-500" />
              <div className="text-right">
                <p className="text-[10px] text-[#4A4A4A]/60 font-bold">سيوثق في</p>
                <p className="text-xs font-black text-[#4A4A4A]">المركز السعودي للأعمال</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-[#4A4A4A] mb-4">روابط هامة</h3>
            <ul className="space-y-3">
              <li><button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">سياسة الاسترجاع والاستبدال</button></li>
              <li><button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">الشروط والأحكام</button></li>
              <li><Link to="/track"      className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">تتبع الطلب</Link></li>
              <li><Link to="/store/cart" className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">سلة التسوق</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-[#4A4A4A] mb-4">تواصل معنا</h3>
            <div className="flex gap-2 flex-wrap mb-6">
              {[
                { id: 'whatsapp',  icon: whatsappIcon,  url: 'https://wa.me/966569663697',                alt: 'WhatsApp' },
                { id: 'instagram', icon: instagramIcon, url: 'https://www.instagram.com/art.moment26/',   alt: 'Instagram' },
                { id: 'snapchat',  icon: snapchatIcon,  url: 'https://www.snapchat.com/add/omsayedkamal', alt: 'Snapchat' },
                { id: 'tiktok',    icon: tiktokIcon,    url: 'https://www.tiktok.com/@art.moment26',      alt: 'TikTok' },
                { id: 'telegram',  icon: telegramIcon,  url: 'https://t.me/+966569663697',                alt: 'Telegram' },
                { id: 'gmail',     icon: gmailIcon,     url: 'mailto:art.moment26@gmail.com',             alt: 'Gmail' },
                { id: 'linktree',  icon: linktreeIcon,  url: 'https://linktr.ee/Art_Moment',              alt: 'Linktree' },
              ].map(social => (
                <a key={social.id} href={social.url}
                  target={social.url.startsWith('mailto') ? '_self' : '_blank'} rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#F8F5F2] border border-[#D9A3AA]/20 flex items-center justify-center hover:bg-[#D9A3AA]/10 hover:-translate-y-1 transition-all duration-300">
                  <img src={social.icon} alt={social.alt} className="w-5 h-5 object-contain" />
                </a>
              ))}
            </div>
            <h3 className="font-black text-[#4A4A4A] mb-3 text-sm">طرق الدفع المدعومة</h3>
            <div className="flex gap-2">
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Mada</div>
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Visa</div>
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Apple</div>
            </div>
          </div>
        </div>
        <div className="w-[96%] max-w-[1600px] mx-auto px-4 text-center border-t border-[#F8F5F2] pt-8">
          <p className="text-xs font-bold text-[#4A4A4A]/50">جميع الحقوق محفوظة لمتجر لحظة فن © {new Date().getFullYear()}</p>
        </div>
      </footer>

      {/* ══════════════════════════════════
          QUICK VIEW MODAL
      ══════════════════════════════════ */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col my-auto animate-in zoom-in-95 duration-300 overflow-hidden relative">

            <button onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 z-10 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white text-[#4A4A4A] transition-colors shadow-sm">
              <X size={20} />
            </button>

            <div className="grid md:grid-cols-2">
              <div className="bg-[#F8F5F2] aspect-square md:aspect-auto md:min-h-80 relative flex items-center justify-center overflow-hidden">
                {selectedProduct.image
                  ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  : <img src={fallbackLogo} alt={selectedProduct.name} className="w-full h-full object-contain p-12 opacity-20 grayscale mix-blend-multiply" />}
              </div>
              <div className="p-6 md:p-8 flex flex-col">
                <span className="text-[#D9A3AA] text-xs font-bold px-3 py-1 bg-[#D9A3AA]/10 rounded-full w-max mb-3">
                  {CATEGORIES.find(c => c.id === selectedProduct.category)?.name || selectedProduct.category}
                </span>
                <h2 className="text-2xl font-black text-[#4A4A4A] mb-3">{selectedProduct.name}</h2>
                <p className="text-2xl font-black text-[#C5A059] mb-6">{selectedProduct.price} <span className="text-sm font-normal">ر.س</span></p>
                <p className="text-sm text-[#4A4A4A]/70 leading-relaxed mb-8 flex-1">
                  {selectedProduct.description || 'تصميم فريد بجودة عالية، صُنع خصيصاً ليحفظ أجمل لحظاتك بأناقة.'}
                </p>
                <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  className="w-full bg-[#4A4A4A] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#D9A3AA] transition-all shadow-lg hover:-translate-y-1">
                  <ShoppingCart size={20} /> أضف إلى السلة
                </button>
              </div>
            </div>

            {getRelatedProducts(selectedProduct).length > 0 && (
              <div className="bg-[#F8F5F2]/50 p-6 md:p-8 border-t border-[#D9A3AA]/15">
                <h3 className="font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
                  <Star size={18} className="text-[#C5A059]" /> أكملي مجموعتك الفنية
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {getRelatedProducts(selectedProduct).map(related => (
                    <div key={related.id} onClick={() => setSelectedProduct(related)}
                      className="bg-white rounded-2xl p-3 border border-[#D9A3AA]/10 shadow-sm cursor-pointer hover:shadow-md hover:border-[#D9A3AA]/40 transition-all group">
                      <div className="aspect-square bg-[#F8F5F2] rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                        {related.image
                          ? <img src={related.image} alt={related.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          : <ImageIcon size={24} className="text-[#D9A3AA]/30" />}
                      </div>
                      <p className="font-bold text-[#4A4A4A] text-xs line-clamp-1 mb-1">{related.name}</p>
                      <p className="font-black text-[#C5A059] text-xs">{related.price} ر.س</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          LEGAL POLICIES MODAL
      ══════════════════════════════════ */}
      {openPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setOpenPolicyModal(false)}>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#F8F5F2] flex justify-between items-center bg-[#F8F5F2]/50">
              <h2 className="text-xl font-black text-[#4A4A4A] flex items-center gap-2">
                <FileText size={20} className="text-[#D9A3AA]" /> السياسات والأحكام
              </h2>
              <button onClick={() => setOpenPolicyModal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#4A4A4A]/80 leading-relaxed">
              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">1. سياسة الاسترجاع والاستبدال للمنتجات الجاهزة</h3>
                <p>نلتزم في "لحظة فن" بنظام التجارة الإلكترونية السعودي. يحق للعميل استرجاع أو استبدال المنتجات الجاهزة (مثل الألبومات الفارغة والإطارات) خلال <strong>7 أيام</strong> من تاريخ الاستلام، بشرط أن يكون المنتج بحالته الأصلية غير مستخدم وفي تغليفه الأصلي. يتحمل العميل تكاليف الشحن المترتبة على الاسترجاع ما لم يكن المنتج معيباً.</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <h3 className="font-black text-red-700 text-base mb-2">2. استثناء المنتجات المخصصة (طباعة الصور)</h3>
                <p className="text-red-600/80">استناداً إلى اللوائح المنظمة، <strong>يُستثنى حق الاسترجاع أو الفسخ</strong> للطلبات التي تُصنع خصيصاً للعميل (مثل طباعة الصور الشخصية). بمجرد تأكيد طلب الطباعة وبدء التنفيذ، لا يمكن إلغاء الطلب أو استرجاع المبلغ، نظراً لخصوصية المنتج وعدم إمكانية إعادة بيعه.</p>
              </div>
              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">3. ضمان التوصيل (شرط الـ 15 يوماً)</h3>
                <p>نسعى دائماً لتوصيل طلباتكم في أسرع وقت ممكن (عادة خلال 24-48 ساعة داخل الأحساء). ونلتزم قانونياً بتسليم الطلب في مدة لا تتجاوز 15 يوماً من تاريخ التأكيد. في حال تجاوز هذه المدة، يحق للعميل إلغاء الطلب واسترداد كامل المبلغ.</p>
              </div>
              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">4. الخصوصية وسرية البيانات</h3>
                <p>نولي في "لحظة فن" خصوصية صوركم وبياناتكم الشخصية أولوية قصوى. تُعالج الصور المرفوعة بسرية تامة لغرض الطباعة فقط، ولا تُشارك مع أي طرف ثالث وتُحذف من خوادمنا بشكل دوري بعد تسليم الطلب.</p>
              </div>
            </div>
            <div className="p-6 border-t border-[#F8F5F2] bg-[#F8F5F2]/30">
              <button onClick={() => setOpenPolicyModal(false)}
                className="w-full bg-[#4A4A4A] text-white py-3 rounded-xl font-bold hover:bg-[#D9A3AA] transition-colors">
                قرأت وموافق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp button */}
      <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer"
        className="fixed bottom-6 left-6 z-40 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group border-4 border-white">
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">تواصل معنا</span>
      </a>

    </div>
  );
}
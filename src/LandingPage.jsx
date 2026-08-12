import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import RiyalSign from './components/RiyalSign';
import { clearCustomerSession, getCustomerSession } from './utils/customerSession';
import {
  canAddProductToCart,
  getStockLabel,
  isProductAvailable,
  normalizeStockQuantity,
} from './utils/productStock';

import {
  Search, MessageCircle, Image as ImageIcon, CheckCircle, Truck,
  Printer, Menu, X, ChevronDown, Lock, Star, Quote, BookOpen,
  Download, Share, PlusSquare, Sparkles, FileText,
  Plane, Gift, Smartphone, LayoutDashboard,
  MessageSquarePlus, Send, CreditCard, Award, Gem, Wallet,
  ShoppingBag, ArrowLeft, ShoppingCart, Plus, ShieldCheck, Scale, AlertCircle, ChevronLeft,
  User, LogOut, Share2
} from 'lucide-react';
import CustomerAuthModal from './components/CustomerAuthModal';
import LanguageToggle from './components/LanguageToggle';
import { markCustomerAuthPromptShown, shouldAutoOpenCustomerAuth } from './utils/customerAuthPrompt';
import { localizeProductOptions } from './utils/productOptions';
import { useLanguage } from './contexts/LanguageContext';

import promoVideo from './assets/printing-quality.mp4';
import printedPhotos from './assets/printed-photos.png';
import logo from './assets/logo-art-moment.svg';
import fallbackLogo from './assets/logo.png';
import instagramIcon from './assets/instagram icon.svg';
import snapchatIcon from './assets/SnapChat icon.svg';
import tiktokIcon from './assets/tiktok icon.svg';
import whatsappIcon from './assets/whatsapp icon.svg';
import telegramIcon from './assets/telegram icon.svg';
import gmailIcon from './assets/gmail icon.svg';
import waseetShopLogo from './assets/waseetshop logo.svg';

const fromDb = (p, language) => {
  const stockQuantity = normalizeStockQuantity(p.stock_quantity);
  return {
    id:           p.id,
    name:         language === 'en' && p.name_en ? p.name_en : p.name,
    description:  language === 'en' && p.description_en ? p.description_en : (p.description || ''),
    price:        p.price,
    category:     p.category,
    image:        p.image       || null,
    hoverImage:   p.hover_image || null,
    sortOrder:    p.sort_order  ?? 0,
    stockQuantity,
    inStock:      (p.in_stock ?? true) && (stockQuantity === null || stockQuantity > 0),
    isBestSeller: p.is_best_seller ?? false,
    productOptions: localizeProductOptions(p.product_options, language),
  };
};

const FAQS = [
  {
    q: 'كم يستغرق تجهيز طلب الطباعة؟',
    qEn: 'How long does a print order take?',
    a: 'يعتمد الوقت على عدد الصور والضغط، لكن عادة يتم التجهيز في نفس اليوم أو اليوم التالي.',
    aEn: 'Timing depends on the number of photos and current demand. Most orders are prepared the same day or the next day.',
  },
  {
    q: 'ما أنواع الملفات المناسبة للطباعة؟',
    qEn: 'Which file types are best for printing?',
    a: 'يفضل إرسال الصور الأصلية بصيغة JPG أو PNG وبأعلى دقة متاحة، وتجنب صور الشاشة المضغوطة قدر الإمكان.',
    aEn: 'Original JPG or PNG files at the highest available resolution are best. Avoid compressed screenshots whenever possible.',
  },
  {
    q: 'ما المقاسات المتاحة؟',
    qEn: 'Which print sizes are available?',
    a: 'نوفر مقاسات الصور الشائعة مثل 4x6، إضافة إلى A4 وخيارات أخرى تظهر داخل المتجر حسب التوفر.',
    aEn: 'Popular sizes such as 4x6 and A4 are available, along with other options shown in the store when in stock.',
  },
  {
    q: 'كيف أعرف أين وصل طلبي؟',
    qEn: 'How can I track my order?',
    a: 'من خلال صفحة تتبع الطلب في الموقع باستخدام رقم الطلب الذي نرسله لك.',
    aEn: 'Use the Track Order page with the order number sent to you after confirmation.',
  },
  {
    q: 'كم يستغرق التوصيل؟',
    qEn: 'How long does delivery take?',
    a: 'يستغرق التوصيل داخل الأحساء عادة 24-48 ساعة، وخارجها من 3 إلى 5 أيام عمل.',
    aEn: 'Delivery usually takes 24-48 hours within Al Ahsa and 3-5 business days elsewhere.',
  },
];

const REVIEWS = [
  { id: 1, name: 'زينب', nameEn: 'Zainab', comment: 'الجودة خرافية والألوان تفتح النفس! التغليف كان ممتاز جداً.', commentEn: 'The quality and colors are wonderful, and the packaging was excellent.', rating: 5 },
  { id: 2, name: 'معصومة', nameEn: 'Masooma', comment: 'تعامل راقي وسرعة في الإنجاز. طلبت الصباح واستلمت العصر.', commentEn: 'Lovely service and fast preparation. I ordered in the morning and received it that afternoon.', rating: 5 },
  { id: 3, name: 'فاطمة', nameEn: 'Fatimah', comment: 'أفضل محل طباعة تعاملت معه في الأحساء، دقة في المواعيد.', commentEn: 'The best printing service I have used in Al Ahsa, with excellent timing.', rating: 4 },
];

const LANDING_COPY = {
  ar: {
    strip: ['توصيل موثوق', 'جودة طباعة', 'خدمة العملاء'],
    navPrint: 'اطبع صورك', navStore: 'المتجر', navTrack: 'تتبع الطلب', navAbout: 'من نحن', navCart: 'السلة',
    heroEyebrow: 'طباعة صور فوتوغرافية في الأحساء',
    heroTitle: 'صورك تستحق أن تُمسك باليد',
    heroText: 'نحوّل لحظاتك الرقمية إلى صور مطبوعة ومنتجات تحفظها لسنوات.',
    printCta: 'اطبع صورك الآن', shopCta: 'تسوّق المستلزمات',
    processEyebrow: 'من الجوال إلى يدك', processTitle: 'طباعة الصور في 3 خطوات',
    processText: 'رحلة واضحة وسريعة، من اختيار المنتج حتى استلام ذكرياتك.',
    categoriesEyebrow: 'تسوّق حسب احتياجك', categoriesTitle: 'كل ما تحتاجه لذكرياتك',
    featuredEyebrow: 'مختارات لحظة فن', featuredTitle: 'الأكثر طلباً',
    featuredText: 'منتجات أحبها عملاؤنا وتعودوا على اختيارها لحفظ أجمل اللحظات.',
    whyEyebrow: 'لماذا لحظة فن؟', whyTitle: 'نهتم بالصورة قبل كل شيء',
    showcaseEyebrow: 'من داخل التجربة', showcaseTitle: 'تفاصيل تُرى وتُحس',
    showcaseText: 'ألوان واضحة، ورق مختار بعناية، وتغليف يحافظ على كل صورة حتى تصل إليك.',
    reviewsEyebrow: 'آراء حقيقية', reviewsTitle: 'قالوا عن لحظة فن', verifiedReview: 'عميلة موثوقة',
    faqEyebrow: 'قبل أن تطبع', faqTitle: 'أسئلة تتكرر كثيراً',
    browseStore: 'تصفح المتجر', noProducts: 'لا توجد منتجات مختارة حالياً', addToCart: 'إضافة إلى السلة', unavailable: 'غير متوفر', inCart: 'في السلة',
    footerText: 'نوثق أجمل لحظاتك بجودة تليق بها، من طباعة الصور إلى الألبومات والإطارات المختارة بعناية.',
    verifiedAt: 'موثق في', businessCenter: 'المركز السعودي للأعمال', importantLinks: 'روابط مهمة',
    returnsPolicy: 'سياسة الاسترجاع والاستبدال', terms: 'الشروط والأحكام', officialAccounts: 'حساباتنا الرسمية', shoppingCart: 'سلة التسوق',
    contactUs: 'تواصل معنا', rights: 'جميع الحقوق محفوظة لمتجر لحظة فن',
  },
  en: {
    strip: ['Fast delivery', 'Photo-quality prints', 'Customer care'],
    navPrint: 'Print Photos', navStore: 'Store', navTrack: 'Track Order', navAbout: 'About Us', navCart: 'Cart',
    heroEyebrow: 'Photo printing in Al Ahsa',
    heroTitle: 'Photos you can hold onto',
    heroText: 'We turn digital moments into beautiful prints and keepsakes made to last.',
    printCta: 'Print Your Photos', shopCta: 'Shop Supplies',
    processEyebrow: 'From your phone to your hands', processTitle: 'Print in 3 simple steps',
    processText: 'A clear, easy journey from choosing your product to receiving your memories.',
    categoriesEyebrow: 'Shop by need', categoriesTitle: 'Everything your memories need',
    featuredEyebrow: 'Art Moment picks', featuredTitle: 'Most Loved',
    featuredText: 'Customer favorites chosen to preserve the moments that matter most.',
    whyEyebrow: 'Why Art Moment?', whyTitle: 'The photo always comes first',
    showcaseEyebrow: 'A closer look', showcaseTitle: 'Details you can see and feel',
    showcaseText: 'Clear color, carefully selected paper, and thoughtful packaging that protects every print.',
    reviewsEyebrow: 'Real reviews', reviewsTitle: 'What customers say', verifiedReview: 'Verified customer',
    faqEyebrow: 'Before you print', faqTitle: 'Frequently asked questions',
    browseStore: 'Browse the Store', noProducts: 'No featured products right now', addToCart: 'Add to Cart', unavailable: 'Out of Stock', inCart: 'In cart',
    footerText: 'We preserve your favorite moments with thoughtful photo printing, albums, and frames made to last.',
    verifiedAt: 'Verified by', businessCenter: 'Saudi Business Center', importantLinks: 'Important Links',
    returnsPolicy: 'Returns and Exchanges', terms: 'Terms and Conditions', officialAccounts: 'Official Accounts', shoppingCart: 'Shopping Cart',
    contactUs: 'Contact Us', rights: 'All rights reserved to Art Moment',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { language, direction } = useLanguage();
  const copy = LANDING_COPY[language] || LANDING_COPY.ar;

  const handleAdminClick = (e) => {
    e.preventDefault();
    navigate(session ? '/app/dashboard' : '/admin/login');
  };

  // --- Store states ---
  const [products, setProducts]               = useState([]);
  const [cart, setCart]                       = useState([]);
  const [toastMsg, setToastMsg]               = useState('');
  const [openPolicyModal, setOpenPolicyModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // --- UI states ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq]                   = useState(null);
  const [scrolled, setScrolled]                 = useState(false);

  // --- PWA states ---
  const [deferredPrompt, setDeferredPrompt]             = useState(null);
  const [isInstallable, setIsInstallable]               = useState(false);
  const [isIOS, setIsIOS]                               = useState(false);
  const [showIOSInstructions, setShowIOSInstructions]   = useState(false);

  // --- Customer auth ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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

  const handleLogout = () => {
    clearCustomerSession();
    setCustomer(null);
    toast.success('تم تسجيل الخروج بنجاح');
  };

  // ─── Effects ───────────────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setProducts((data || []).map((product) => fromDb(product, language)));
      } catch (err) {
        console.error('Error fetching products:', err);
        setProducts([]);
      }
    };
    fetchProducts();

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
    setCart(savedCart);
  }, [language]);

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

  // ─── Store logic ────────────────────────────────────────────
  const getCategoryLabel = (cat) => {
    if (cat === 'all')      return 'الكل';
    if (cat === 'albums')   return 'ألبومات';
    if (cat === 'frames')   return 'إطارات';
    if (cat === 'stickers') return 'ملصقات';
    return cat;
  };

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const addToCart = (product) => {
    if (product.productOptions?.length > 0) {
      navigate(`/store/products/${product.id}`);
      return;
    }
    const currentQty = getProductQty(product.id);
    if (!canAddProductToCart(product, currentQty)) {
      showToast('وصلت إلى الكمية المتوفرة لهذا المنتج');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, ...product, qty: item.qty + 1 } : item);
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
    const getProductText = (product) =>
      `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
    const hasSmallPrintSize = (text) =>
      /(?:10\s*[x×*]\s*15)|(?:4\s*[x×*]\s*6)|(?:4×6)|(?:10×15)/i.test(text);
    const currentText = getProductText(currentProduct);
    const currentIsA4 = currentText.includes('a4');
    const currentIsSmall = hasSmallPrintSize(currentText);

    return products
      .filter(p => p.id !== currentProduct.id && p.inStock)
      .map(product => {
        const text = getProductText(product);
        let score = product.category !== currentProduct.category ? 1 : 0;
        if (currentIsA4) {
          if (product.category === 'frames') score += 4;
          if (text.includes('a4')) score += 3;
        }
        if (currentIsSmall) {
          if (product.category === 'albums') score += 4;
          if (hasSmallPrintSize(text)) score += 3;
        }
        return { product, score };
      })
      .sort((a, b) => b.score - a.score || (a.product.sortOrder || 0) - (b.product.sortOrder || 0))
      .map(item => item.product)
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

  return (
    <div className="art-page min-h-screen font-[Tajawal] relative overflow-x-hidden selection:bg-[#E8B4BC] selection:text-white" dir={direction}>

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#C6A56B] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle size={18} /> {toastMsg}
        </div>
      )}

      {/* iOS PWA instructions modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FAF9F7] w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 left-4 text-[#171717] hover:text-[#C6A56B]"><X size={24} /></button>
            <div className="text-center mb-6">
              <img src={logo} alt="App Icon" className="w-16 h-16 mx-auto mb-2 object-contain" />
              <h3 className="text-xl font-black text-[#171717]">تثبيت تطبيق لحظة فن</h3>
            </div>
            <div className="space-y-4 text-sm font-medium text-[#171717]">
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><Share size={20} className="text-[#C6A56B]" /> <span>1. اضغط زر "مشاركة"</span></div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><PlusSquare size={20} className="text-[#C6A56B]" /> <span>2. اختر "إضافة للشاشة الرئيسية"</span></div>
            </div>
            <button onClick={() => setShowIOSInstructions(false)} className="w-full mt-6 bg-[#E8B4BC] text-white py-3 rounded-xl font-bold hover:bg-[#C6A56B] transition-colors">فهمت ذلك</button>
          </div>
        </div>
      )}

      <div className="bg-[#171717] text-white">
        <div className="art-shell min-h-9 py-2 flex flex-nowrap items-center justify-center gap-3 sm:gap-8 text-[9px] sm:text-xs font-bold text-white/80">
          {copy.strip.map((item, index) => (
            <span key={item} className="flex items-center gap-1.5">
              {index === 0 && <Truck size={13} className="text-[#E8B4BC]" />}
              {index === 1 && <Award size={13} className="text-[#C6A56B]" />}
              {index === 2 && <MessageCircle size={13} className="text-[#E8B4BC]" />}
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════ NAVBAR ══════════════════════════════════ */}
      <header className={`sticky top-0 z-50 art-nav transition-all duration-300 ${scrolled ? 'art-nav-scrolled' : ''}`}>
        <div className="art-shell h-20 flex items-center justify-between">

          {/* Right Side: Mobile Menu + Logo */}
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              className="md:hidden p-1 -mr-2 text-[#171717]"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              title={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={logo} alt="Art Moment Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-xl font-black text-[#171717] leading-none">
                  {language === 'en' ? 'Art Moment' : 'لحظة فن'}
                </h1>
                <span className="text-[9px] sm:text-[10px] text-[#C6A56B] font-bold tracking-widest uppercase">
                  {language === 'en' ? 'Photo Printing & Gifts' : 'Art Moment'}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-[#171717]/80">
            <Link to="/print" className="hover:text-[#E8B4BC] transition-colors">{copy.navPrint}</Link>
            <Link to="/store" className="hover:text-[#E8B4BC] transition-colors">{copy.navStore}</Link>
            <Link to="/track" className="hover:text-[#E8B4BC] transition-colors">{copy.navTrack}</Link>
            <a href="#why" className="hover:text-[#E8B4BC] transition-colors">{copy.navAbout}</a>
            <Link to="/store/cart" className="hover:text-[#E8B4BC] transition-colors flex items-center gap-1.5">
              <ShoppingCart size={16} className="text-[#E8B4BC]" /> {copy.navCart}
              {cartCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#171717] text-white text-[10px] grid place-items-center">{cartCount}</span>}
            </Link>
          </nav>

          {/* Left Side: Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {(isInstallable || isIOS) && (
              <button onClick={handleInstallClick} className="flex items-center gap-2 px-4 py-2 bg-[#E8B4BC] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#C6A56B] transition-all">
                <Download size={16} /> <span className="hidden sm:inline">تحميل التطبيق</span>
              </button>
            )}


            <button onClick={handleAdminClick} className="hidden sm:inline-flex bg-white text-[#171717] border border-[#E8B4BC]/20 px-3 py-2 rounded-full hover:text-[#E8B4BC] transition-all shadow-sm">
              <Lock size={16} />
            </button>

            <LanguageToggle />

            {customer ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={() => setIsAccountSidebarOpen(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#171717] bg-white px-3 py-2 rounded-full border border-[#E8B4BC]/20 hover:bg-[#E8B4BC]/10 transition-colors shadow-sm">
                  <User size={16} className="text-[#C6A56B]" /> {customer.name ? customer.name.split(' ')[0] : 'حسابي'}
                </button>
                <button onClick={() => setIsAccountSidebarOpen(true)} className="sm:hidden p-2 text-[#171717] bg-white rounded-full border border-[#E8B4BC]/20 transition-colors" title="حسابي">
                  <User size={16} />
                </button>
                <button onClick={handleLogout} className="hidden sm:flex p-2 text-red-400 hover:text-red-500 bg-red-50 hover:bg-red-100 rounded-full transition-colors" title="تسجيل الخروج">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 bg-white text-[#171717] border border-[#E8B4BC]/20 px-3 py-2 rounded-full hover:text-[#E8B4BC] transition-all shadow-sm text-xs font-bold">
                <User size={16} /> <span className="hidden sm:inline">دخول</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#FAF9F7] border-t border-[#E8B4BC]/10 p-4 space-y-3 shadow-xl absolute w-full z-50">
            <Link to="/print" className="block py-2 text-[#171717] font-bold" onClick={() => setIsMobileMenuOpen(false)}>{copy.navPrint}</Link>
            <Link to="/store" className="flex items-center gap-2 py-2 text-[#E8B4BC] font-bold" onClick={() => setIsMobileMenuOpen(false)}><ShoppingBag size={16} /> {copy.navStore}</Link>
            <Link to="/track" className="block py-2 text-[#171717] font-bold" onClick={() => setIsMobileMenuOpen(false)}>{copy.navTrack}</Link>
            <a href="#why" className="block py-2 text-[#171717] font-bold" onClick={() => setIsMobileMenuOpen(false)}>{copy.navAbout}</a>
            <Link to="/store/cart" className="flex w-full items-center justify-center gap-2 py-3 bg-white rounded-xl font-bold text-[#171717] border border-[#E8B4BC]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}><ShoppingCart size={16} /> {copy.navCart} ({cartCount})</Link>
            <Link to="/links" className="flex w-full items-center justify-center gap-2 py-3 bg-white rounded-xl font-bold text-[#171717] border border-[#E8B4BC]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}><Share2 size={16} className="text-[#C6A56B]" /> {language === 'en' ? 'Our Accounts' : 'حساباتنا'}</Link>
            {customer && (
              <button
                onClick={() => { setIsMobileMenuOpen(false); setIsAccountSidebarOpen(true); }}
                className="block w-full text-center py-3 bg-white rounded-xl font-bold text-[#171717] border border-[#C6A56B]/20 shadow-sm"
              >
                حسابي
              </button>
            )}
            <button onClick={(e) => { setIsMobileMenuOpen(false); handleAdminClick(e); }}
              className="w-full text-center py-3 rounded-xl font-bold text-[#171717]/60 hover:bg-white hover:text-[#E8B4BC] transition-all flex items-center justify-center gap-2">
              <Lock size={16} /> دخول المسؤول
            </button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════ HERO ══════════════════════════════════ */}
      <section className="pt-6 pb-8 art-shell">
        <div className="art-hero-card art-crop-marks relative min-h-[500px] sm:min-h-[540px] overflow-hidden rounded-lg p-7 sm:p-10 md:p-14 flex items-end sm:items-center justify-center text-center text-white">
          <img
            src={printedPhotos}
            alt={language === 'en' ? 'A collection of printed photos by Art Moment' : 'مجموعة صور مطبوعة من لحظة فن'}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#171717]/60" />
          <div className="max-w-4xl mx-auto relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 text-[#171717] text-[10px] sm:text-xs font-bold border border-white mx-auto shadow-sm">
              <Sparkles size={14} className="text-[#C6A56B]" /> {copy.heroEyebrow}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white leading-tight md:leading-tight">{copy.heroTitle}</h1>

            <p className="text-sm md:text-base text-white/70 leading-relaxed mx-auto max-w-lg">
              {copy.heroText}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
              <Link to="/print" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-[#171717] border border-white font-black hover:bg-[#FAF9F7] flex items-center justify-center gap-2 transition-colors shadow-lg">
                <Printer size={20} className="text-[#E8B4BC]" /> {copy.printCta}
              </Link>
              <Link to="/store" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#171717]/75 border border-white/60 text-white font-bold hover:bg-[#171717] flex items-center justify-center gap-2 transition-colors">
                <ShoppingBag size={20} className="text-[#C6A56B]" /> {copy.shopCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════ PRINT PROCESS ══════════════════════════════════ */}
      <section id="print-process" className="art-shell py-12 sm:py-16 scroll-mt-28">
        <div className="max-w-2xl mb-9 sm:mb-12">
          <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.processEyebrow}</p>
          <h2 className="text-2xl sm:text-4xl font-black text-[#171717] mb-3">{copy.processTitle}</h2>
          <p className="text-sm sm:text-base text-[#171717]/60 leading-relaxed">{copy.processText}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-y border-[#171717]/10">
          {[
            { icon: ShoppingBag, ar: 'اختر منتج الطباعة والمقاس المناسب', en: 'Choose your print product and size' },
            { icon: ImageIcon, ar: 'أرسل صورك الأصلية بأعلى دقة', en: 'Send your original, high-resolution photos' },
            { icon: Truck, ar: 'نطبع ونغلف ثم نوصّل طلبك', en: 'We print, package, and deliver your order' },
          ].map((step, index) => (
            <div key={step.ar} className="relative px-4 py-7 sm:p-8 border-b md:border-b-0 md:border-e border-[#171717]/10 last:border-0">
              <span className="absolute top-6 end-4 text-5xl font-black text-[#171717]/5">0{index + 1}</span>
              <step.icon size={28} strokeWidth={1.6} className={index === 1 ? 'text-[#E8B4BC]' : 'text-[#C6A56B]'} />
              <h3 className="mt-5 max-w-xs font-black text-[#171717] leading-relaxed">{language === 'en' ? step.en : step.ar}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════ CATEGORIES ══════════════════════════════════ */}
      <section id="categories" className="art-shell py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-9 sm:mb-12">
          <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.categoriesEyebrow}</p>
          <h2 className="text-2xl sm:text-4xl font-black text-[#171717]">{copy.categoriesTitle}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[
            { icon: Printer, ar: 'مقاسات الطباعة', en: 'Print Sizes', to: '/print' },
            { icon: BookOpen, ar: 'الألبومات', en: 'Albums', to: '/store?category=albums' },
            { icon: LayoutDashboard, ar: 'الإطارات', en: 'Frames', to: '/store?category=frames' },
            { icon: Gift, ar: 'المستلزمات', en: 'Supplies', to: '/store' },
          ].map((category, index) => (
            <Link key={category.ar} to={category.to} className="group min-h-40 sm:min-h-48 bg-white border border-[#171717]/10 rounded-lg p-5 sm:p-7 flex flex-col justify-between hover:border-[#E8B4BC] hover:-translate-y-1 hover:shadow-lg transition-all">
              <category.icon size={30} strokeWidth={1.5} className={index % 2 === 0 ? 'text-[#E8B4BC]' : 'text-[#C6A56B]'} />
              <div className="flex items-end justify-between gap-2">
                <h3 className="font-black text-[#171717] text-sm sm:text-lg">{language === 'en' ? category.en : category.ar}</h3>
                <ArrowLeft size={18} className={`text-[#171717]/35 group-hover:text-[#171717] transition-all ${language === 'en' ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
          2. STORE PRODUCTS GRID
      ══════════════════════════════════ */}
      <main id="products" className="art-shell py-12 sm:py-14">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.featuredEyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#171717] mb-4">
            {copy.featuredTitle}
          </h2>
          <p className="text-sm sm:text-base text-[#171717]/60 leading-relaxed">
            {copy.featuredText}
          </p>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-8">
          {products.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[#171717]/50 font-bold">{copy.noProducts}</div>
          ) : (
            products.filter(p => p.isBestSeller).slice(0, 6).map(product => {
              const productQty = getProductQty(product.id);
              const canAddProduct = canAddProductToCart(product, productQty);
              const productAvailable = isProductAvailable(product);

              return (
              <div key={product.id} className={`art-product-card p-3 sm:p-4 lg:p-5 group flex flex-col relative overflow-hidden ${productAvailable ? '' : 'opacity-75 cursor-not-allowed'}`}>
                <div
                  onClick={() => productAvailable && navigate(`/store/products/${product.id}`)}
                  className={`art-product-media aspect-square rounded mb-4 relative overflow-hidden flex items-center justify-center transition-transform duration-500 ${productAvailable ? 'cursor-pointer group-hover:scale-[1.02]' : 'grayscale'}`}
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
                  {!productAvailable && (
                    <div className="absolute top-3 left-3 z-20 bg-red-500/90 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1.5">
                      <AlertCircle size={12} /> نفدت الكمية
                    </div>
                  )}
                  <span className={`absolute bottom-2 right-2 z-20 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm border ${
                    productAvailable
                      ? 'bg-white/90 text-[#171717] border-[#E8B4BC]/20'
                      : 'bg-red-500 text-white border-red-400'
                  }`}>
                    {getStockLabel(product)}
                  </span>
                  {productAvailable && productQty > 0 && (
                    <span className="absolute top-2 right-2 bg-[#C6A56B] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                      {copy.inCart}: {productQty}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <h3 className="font-black text-[#171717] text-sm md:text-base line-clamp-2 leading-snug mb-1">{product.name}</h3>
                  <p className="text-[#171717]/50 text-xs line-clamp-2 mb-3 flex-1">{product.description}</p>
                  <div className="mt-auto pt-3 border-t border-[#FAF9F7] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#E8B4BC]">{product.price} <span className="text-[10px]">ر.س</span></span>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!canAddProduct}
                      className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-black ${
                        canAddProduct
                          ? 'bg-[#171717] text-white hover:bg-[#E8B4BC] shadow-md'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span>{productAvailable ? copy.addToCart : copy.unavailable}</span>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* View Full Store CTA */}
        {products.length > 0 && (
          <div className="mt-12 sm:mt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <Link
              to="/store"
              className="art-cta inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-full font-black text-lg transition-all duration-300 group"
            >
              <ShoppingBag size={24} className="group-hover:scale-110 transition-transform" />
              {copy.browseStore} ({products.length})
            </Link>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════ WHY ART MOMENT ══════════════════════════════════ */}
      <section id="why" className="art-shell py-14 sm:py-20 scroll-mt-28">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.whyEyebrow}</p>
          <h2 className="text-2xl sm:text-4xl font-black text-[#171717]">{copy.whyTitle}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-[#171717]/10">
          {[
            { icon: Award, ar: 'جودة طباعة واضحة', en: 'Crisp print quality', textAr: 'ورق وألوان مختارة لتبقى الصورة جميلة.', textEn: 'Paper and color selected to keep every photo beautiful.' },
            { icon: ShieldCheck, ar: 'خصوصية صورك', en: 'Your photos stay private', textAr: 'تُستخدم ملفاتك لتنفيذ الطلب فقط.', textEn: 'Your files are used only to fulfil your order.' },
            { icon: Smartphone, ar: 'طلب سهل', en: 'Simple ordering', textAr: 'تجربة واضحة من الجوال وحتى الاستلام.', textEn: 'A clear experience from mobile order to delivery.' },
            { icon: Gift, ar: 'تغليف بعناية', en: 'Thoughtful packaging', textAr: 'نحمي المطبوعات لتصل بحالة ممتازة.', textEn: 'Prints are protected so they arrive in excellent condition.' },
          ].map((feature, index) => (
            <div key={feature.ar} className="p-5 sm:p-8 border-b border-e border-[#171717]/10 [&:nth-child(2n)]:border-e-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-e lg:last:border-e-0">
              <feature.icon size={28} strokeWidth={1.5} className={index % 2 === 0 ? 'text-[#E8B4BC]' : 'text-[#C6A56B]'} />
              <h3 className="mt-5 font-black text-[#171717] text-sm sm:text-base">{language === 'en' ? feature.en : feature.ar}</h3>
              <p className="mt-2 text-xs sm:text-sm text-[#171717]/55 leading-relaxed">{language === 'en' ? feature.textEn : feature.textAr}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════ SHOWCASE ══════════════════════════════════ */}
      <section className="art-shell py-10 sm:py-16">
        <div className="art-crop-marks relative rounded-lg overflow-hidden shadow-xl border-[8px] border-white h-[390px] md:h-[520px] flex items-center justify-center group bg-[#171717]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-85 transition-transform duration-1000 group-hover:scale-[1.02]"
          >
            <source src={promoVideo} type="video/mp4" />
            {language === 'en' ? 'Your browser does not support video.' : 'متصفحك لا يدعم تشغيل الفيديو.'}
          </video>
          <div className="absolute inset-0 bg-[#171717]/35" />
          <div className="relative z-10 text-center px-6 mt-auto pb-10 sm:pb-14 w-full">
            <p className="text-xs font-black text-[#C6A56B] mb-3">{copy.showcaseEyebrow}</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">{copy.showcaseTitle}</h2>
            <p className="text-sm sm:text-base text-white/80 max-w-2xl mx-auto leading-relaxed">{copy.showcaseText}</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════ REAL REVIEWS ══════════════════════════════════ */}
      <section id="reviews" className="art-shell py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.reviewsEyebrow}</p>
          <h2 className="text-2xl sm:text-4xl font-black text-[#171717]">{copy.reviewsTitle}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {REVIEWS.map((review) => {
            const reviewName = language === 'en' ? review.nameEn : review.name;
            return (
              <article key={review.id} className="bg-white border border-[#171717]/10 rounded-lg p-6 sm:p-8 shadow-sm">
                <Quote size={28} strokeWidth={1.5} className="text-[#E8B4BC] mb-6" />
                <div className="flex gap-1 text-[#C6A56B] mb-4" aria-label={`${review.rating} / 5`}>
                  {[...Array(5)].map((_, index) => (
                    <Star key={index} size={15} fill={index < review.rating ? 'currentColor' : 'none'} className={index < review.rating ? '' : 'text-[#171717]/15'} />
                  ))}
                </div>
                <p className="text-sm text-[#171717]/75 leading-7 min-h-20">“{language === 'en' ? review.commentEn : review.comment}”</p>
                <div className="mt-6 pt-5 border-t border-[#171717]/10 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[#FAF9F7] grid place-items-center font-black text-[#171717]">{reviewName.charAt(0)}</span>
                  <div>
                    <p className="font-black text-sm text-[#171717]">{reviewName}</p>
                    <p className="text-[10px] text-[#171717]/45">{copy.verifiedReview}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════ FAQ ══════════════════════════════════ */}
      <section id="faq" className="art-shell py-14 sm:py-20">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-black text-[#C6A56B] mb-2">{copy.faqEyebrow}</p>
            <h2 className="text-2xl sm:text-4xl font-black text-[#171717]">{copy.faqTitle}</h2>
          </div>
          <div className="border-t border-[#171717]/10">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="border-b border-[#171717]/10">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full py-5 sm:py-6 flex items-center justify-between gap-5 text-start"
                    aria-expanded={isOpen}
                  >
                    <span className="font-black text-sm sm:text-base text-[#171717]">{language === 'en' ? faq.qEn : faq.q}</span>
                    <ChevronDown size={19} className={`shrink-0 text-[#E8B4BC] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="pb-6 text-sm text-[#171717]/60 leading-7 animate-in fade-in slide-in-from-top-1">
                      {language === 'en' ? faq.aEn : faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          9. PROFESSIONAL FOOTER
      ══════════════════════════════════ */}
      <footer className="bg-white border-t border-[#E8B4BC]/20 pt-16 pb-32 sm:pb-8">
        <div className="art-shell grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="لحظة فن" className="w-10 h-10 object-contain grayscale opacity-80" />
              <h2 className="text-xl font-black text-[#171717]">{language === 'en' ? 'Art Moment' : 'لحظة فن'}</h2>
            </div>
            <p className="text-sm text-[#171717]/70 leading-relaxed mb-6">{copy.footerText}</p>
            <div className="flex items-center gap-2 bg-[#FAF9F7] w-max px-4 py-2 rounded-xl border border-[#E8B4BC]/20">
              <ShieldCheck size={18} className="text-emerald-500" />
              <div className="text-start">
                <p className="text-[10px] text-[#171717]/60 font-bold">{copy.verifiedAt}</p>
                <p className="text-xs font-black text-[#171717]">{copy.businessCenter}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-[#171717] mb-4">{copy.importantLinks}</h3>
            <ul className="space-y-3">
              <li><button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#171717]/70 hover:text-[#E8B4BC] font-bold transition-colors">{copy.returnsPolicy}</button></li>
              <li><button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#171717]/70 hover:text-[#E8B4BC] font-bold transition-colors">{copy.terms}</button></li>
              <li><Link to="/track"      className="text-sm text-[#171717]/70 hover:text-[#E8B4BC] font-bold transition-colors">{copy.navTrack}</Link></li>
              <li><Link to="/links"      className="text-sm text-[#171717]/70 hover:text-[#E8B4BC] font-bold transition-colors">{copy.officialAccounts}</Link></li>
              <li><Link to="/store/cart" className="text-sm text-[#171717]/70 hover:text-[#E8B4BC] font-bold transition-colors">{copy.shoppingCart}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-[#171717] mb-4">{copy.contactUs}</h3>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'whatsapp',  icon: whatsappIcon,  url: 'https://wa.me/966560301744',                alt: 'WhatsApp' },
                { id: 'instagram', icon: instagramIcon, url: 'https://www.instagram.com/art.moment26/',   alt: 'Instagram' },
                { id: 'snapchat',  icon: snapchatIcon,  url: 'https://www.snapchat.com/add/omsayedkamal', alt: 'Snapchat' },
                { id: 'tiktok',    icon: tiktokIcon,    url: 'https://www.tiktok.com/@art.moment26',      alt: 'TikTok' },
                { id: 'telegram',  icon: telegramIcon,  url: 'https://t.me/artmoment26',                  alt: 'Telegram' },
                { id: 'gmail',     icon: gmailIcon,     url: 'mailto:art.moment26@gmail.com',             alt: 'Gmail' },
              ].map(social => (
                <a key={social.id} href={social.url}
                  target={social.url.startsWith('mailto') ? '_self' : '_blank'} rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#FAF9F7] border border-[#E8B4BC]/20 flex items-center justify-center hover:bg-[#E8B4BC]/10 hover:-translate-y-1 transition-all duration-300">
                  <img src={social.icon} alt={social.alt} className="w-5 h-5 object-contain" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="art-shell flex flex-col items-center gap-4 border-t border-[#FAF9F7] pt-8 text-center">
          <p className="text-xs font-bold text-[#171717]/50">{copy.rights} © {new Date().getFullYear()}</p>
          <a
            href="https://waseet-shop.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#171717]/60 transition-colors hover:text-[#056ab3]"
            aria-label="زيارة منصة وسيط شوب"
          >
            <span>{language === 'en' ? 'Website designed by Waseet Shop' : 'تم تصميم الموقع بواسطة منصة (وسيط شوب)'}</span>
            <img src={waseetShopLogo} alt="وسيط شوب" className="h-7 w-7 object-contain" />
          </a>
        </div>
      </footer>

      {/* QUICK VIEW MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && setSelectedProduct(null)}>
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col my-auto animate-in zoom-in-95 duration-300 overflow-hidden relative">

            <button onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 z-10 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white text-[#171717] transition-colors shadow-sm">
              <X size={20} />
            </button>

            <div className="grid md:grid-cols-2">
              <div className="bg-[#FAF9F7] aspect-square md:aspect-auto md:min-h-80 relative flex items-center justify-center overflow-hidden">
                {selectedProduct.image
                  ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  : <img src={fallbackLogo} alt={selectedProduct.name} className="w-full h-full object-contain p-12 opacity-20 grayscale mix-blend-multiply" />}
              </div>
              <div className="p-6 md:p-8 flex flex-col">
                <span className="text-[#E8B4BC] text-xs font-bold px-3 py-1 bg-[#E8B4BC]/10 rounded-full w-max mb-3">
                  {getCategoryLabel(selectedProduct.category)}
                </span>
                <h2 className="text-2xl font-black text-[#171717] mb-3">{selectedProduct.name}</h2>
                <p className="text-2xl font-black text-[#C6A56B] mb-6">{selectedProduct.price} <span className="text-sm font-normal">ر.س</span></p>
                <p className="text-sm text-[#171717]/70 leading-relaxed mb-8 flex-1">
                  {selectedProduct.description || 'تصميم فريد بجودة عالية، صُنع خصيصاً ليحفظ أجمل لحظاتك بأناقة.'}
                </p>
                <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  className="w-full bg-[#171717] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#E8B4BC] transition-all shadow-lg hover:-translate-y-1">
                  <ShoppingCart size={20} /> أضف إلى السلة
                </button>
              </div>
            </div>

            {getRelatedProducts(selectedProduct).length > 0 && (
              <div className="bg-[#FAF9F7]/50 p-6 md:p-8 border-t border-[#E8B4BC]/15">
                <h3 className="font-black text-[#171717] mb-4 flex items-center gap-2">
                  <Star size={18} className="text-[#C6A56B]" /> أكملي مجموعتك الفنية
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {getRelatedProducts(selectedProduct).map(related => (
                    <div key={related.id} onClick={() => setSelectedProduct(related)}
                      className="bg-white rounded-2xl p-3 border border-[#E8B4BC]/10 shadow-sm cursor-pointer hover:shadow-md hover:border-[#E8B4BC]/40 transition-all group">
                      <div className="aspect-square bg-[#FAF9F7] rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                        {related.image
                          ? <img src={related.image} alt={related.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          : <ImageIcon size={24} className="text-[#E8B4BC]/30" />}
                      </div>
                      <p className="font-bold text-[#171717] text-xs line-clamp-1 mb-1">{related.name}</p>
                      <p className="font-black text-[#C6A56B] text-xs">{related.price} ر.س</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEGAL POLICIES MODAL */}
      {openPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setOpenPolicyModal(false)}>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#FAF9F7] flex justify-between items-center bg-[#FAF9F7]/50">
              <h2 className="text-xl font-black text-[#171717] flex items-center gap-2">
                <FileText size={20} className="text-[#E8B4BC]" /> السياسات والأحكام
              </h2>
              <button onClick={() => setOpenPolicyModal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#171717]/80 leading-relaxed">
              <div>
                <h3 className="font-black text-[#171717] text-base mb-2">1. سياسة الاسترجاع والاستبدال للمنتجات الجاهزة</h3>
                <p>نلتزم في "لحظة فن" بنظام التجارة الإلكترونية السعودي. يحق للعميل استرجاع أو استبدال المنتجات الجاهزة (مثل الألبومات الفارغة والإطارات) خلال <strong>7 أيام</strong> من تاريخ الاستلام، بشرط أن يكون المنتج بحالته الأصلية غير مستخدم وفي تغليفه الأصلي. يتحمل العميل تكاليف الشحن المترتبة على الاسترجاع ما لم يكن المنتج معيباً.</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <h3 className="font-black text-red-700 text-base mb-2">2. استثناء المنتجات المخصصة (طباعة الصور)</h3>
                <p className="text-red-600/80">استناداً إلى اللوائح المنظمة، <strong>يُستثنى حق الاسترجاع أو الفسخ</strong> للطلبات التي تُصنع خصيصاً للعميل (مثل طباعة الصور الشخصية). بمجرد تأكيد طلب الطباعة وبدء التنفيذ، لا يمكن إلغاء الطلب أو استرجاع المبلغ، نظراً لخصوصية المنتج وعدم إمكانية إعادة بيعه.</p>
              </div>
              <div>
                <h3 className="font-black text-[#171717] text-base mb-2">3. ضمان التوصيل (شرط الـ 15 يوماً)</h3>
                <p>نسعى دائماً لتوصيل طلباتكم في أسرع وقت ممكن (عادة خلال 24-48 ساعة داخل الأحساء). ونلتزم قانونياً بتسليم الطلب في مدة لا تتجاوز 15 يوماً من تاريخ التأكيد. في حال تجاوز هذه المدة، يحق للعميل إلغاء الطلب واسترداد كامل المبلغ.</p>
              </div>
              <div>
                <h3 className="font-black text-[#171717] text-base mb-2">4. الخصوصية وسرية البيانات</h3>
                <p>نولي في "لحظة فن" خصوصية صوركم وبياناتكم الشخصية أولوية قصوى. تُعالج الصور المرفوعة بسرية تامة لغرض الطباعة فقط، ولا تُشارك مع أي طرف ثالث وتُحذف من خوادمنا بشكل دوري بعد تسليم الطلب.</p>
              </div>
            </div>
            <div className="p-6 border-t border-[#FAF9F7] bg-[#FAF9F7]/30">
              <button onClick={() => setOpenPolicyModal(false)}
                className="w-full bg-[#171717] text-white py-3 rounded-xl font-bold hover:bg-[#E8B4BC] transition-colors">
                قرأت وموافق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button — redirects to full store for cross-selling */}
      {cartCount > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10">
        <Link to="/store" className="flex items-center gap-3 bg-[#171717] text-white px-6 py-3.5 rounded-full font-black hover:shadow-2xl hover:scale-105 transition-all shadow-lg border-2 border-white group">
            <ShoppingBag size={20} className="group-hover:-translate-y-1 transition-transform" />
            أكمل طلبك من المتجر ({cartCount})
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </Link>
        </div>
      )}

      {isAccountSidebarOpen && customer && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAccountSidebarOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-[#FAF9F7] h-[100dvh] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col" dir="rtl">
            <div className="art-auth-header text-white p-6 pb-8 relative overflow-hidden shrink-0 rounded-bl-3xl">
              <button onClick={() => setIsAccountSidebarOpen(false)} className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20">
                <X size={18} />
              </button>
              <div className="flex items-center gap-4 mt-6 relative z-10">
            <div className="w-16 h-16 bg-[#E8B4BC] text-[#171717] rounded-full flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white shrink-0">
                  {customer.name ? customer.name.charAt(0) : <User size={28} />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{customer.name || 'عميل لحظة فن'}</h2>
                  <p className="text-white/70 text-sm font-mono mt-1 truncate" dir="ltr">{customer.phone}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Link to="/store/orders" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#E8B4BC]/10 flex flex-col items-center justify-center gap-2 hover:border-[#E8B4BC]/40 transition-colors group">
                  <div className="w-12 h-12 bg-[#E8B4BC]/10 rounded-full flex items-center justify-center text-[#E8B4BC] group-hover:scale-110 transition-transform">
                    <ShoppingBag size={22} />
                  </div>
                  <span className="font-bold text-sm text-[#171717]">طلباتي</span>
                </Link>
                <Link to="/store/orders" onClick={() => setIsAccountSidebarOpen(false)} className="bg-white p-4 rounded-2xl shadow-sm border border-[#C6A56B]/10 flex flex-col items-center justify-center gap-2 hover:border-[#C6A56B]/40 transition-colors group">
                  <div className="w-12 h-12 bg-[#C6A56B]/10 rounded-full flex items-center justify-center text-[#C6A56B] group-hover:scale-110 transition-transform">
                    <Wallet size={22} />
                  </div>
                  <span className="font-bold text-sm text-[#171717]">المحفظة</span>
                </Link>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8B4BC]/10">
                <h3 className="font-black text-[#171717] mb-4 flex items-center gap-2">
                  <User size={16} className="text-[#C6A56B]" /> بيانات الحساب
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#171717]/50 block mb-1">الاسم</label>
                    <input type="text" defaultValue={customer.name || ''} readOnly className="w-full bg-[#FAF9F7] border border-transparent rounded-xl px-4 py-3 text-sm outline-none text-[#171717] font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#171717]/50 block mb-1">البريد الإلكتروني</label>
                    <input type="email" defaultValue={customer.email || 'غير مسجل'} readOnly className="w-full bg-[#FAF9F7] border border-transparent rounded-xl px-4 py-3 text-sm outline-none dir-ltr text-right text-[#171717] font-bold" />
                  </div>
                  <Link
                    to="/store/account"
                    onClick={() => setIsAccountSidebarOpen(false)}
                    className="w-full py-3 mt-2 bg-[#FAF9F7] text-[#171717] font-bold text-xs rounded-xl hover:bg-[#E8B4BC]/10 transition-colors border border-[#E8B4BC]/20 flex items-center justify-center gap-2"
                  >
                    <User size={15} className="text-[#C6A56B]" /> إدارة الحساب
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-[#E8B4BC]/10 shrink-0">
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

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        initialMode="login"
        onClose={() => {
          setIsAuthModalOpen(false);
          setCustomer(getCustomerSession());
        }}
      />

      {/* Floating WhatsApp button */}
      {scrolled && (
        <a href="https://wa.me/966560301744" target="_blank" rel="noreferrer"
          className="fixed bottom-3 left-3 sm:bottom-6 sm:left-6 z-40 bg-[#25D366] hover:bg-[#128C7E] text-white p-3 sm:p-4 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-2 group border-2 sm:border-4 border-white animate-in fade-in zoom-in-90">
          <MessageCircle size={22} className="sm:w-7 sm:h-7" />
          <span className="hidden sm:block max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">{language === 'en' ? 'Contact us' : 'تواصل معنا'}</span>
        </a>
      )}

    </div>
  );
}

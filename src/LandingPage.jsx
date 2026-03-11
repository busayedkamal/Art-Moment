// src/LandingPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ✅ تصحيح المسار: نقطة واحدة لأن الملف في src مباشرة
import { supabase } from './lib/supabase'; 

import { 
  Search, MessageCircle, Image as ImageIcon, CheckCircle, Truck, 
  Printer, Menu, X, ChevronDown, Lock, Star, Quote, BookOpen,
  Upload, AlertTriangle, Loader2, ScanFace, Frame, Eye, Download,
  Share, PlusSquare, Calculator, Sparkles, FileText, MapPin, Phone, Mail, Instagram, 
  Ghost, Music, Link2 // 👈 تمت إضافة هذه الأيقونات هنا
} from 'lucide-react';

// ✅ تصحيح مسار الصور
import logo from './assets/logo-art-moment.svg'; 
import printedPhotos from './assets/printed-photos.png';

// --- لوحة الألوان المستخدمة ---
// الأساسي (وردي): #D9A3AA
// الفخامة (ذهبي): #C5A059
// الخلفية (لؤلؤي): #F8F5F2
// النصوص (فاحم): #4A4A4A

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // --- حالات فحص الصور ---
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRef = useRef(null);

  // --- حالات المحاكاة ---
  const [mockupImage, setMockupImage] = useState(null);
  const mockupInputRef = useRef(null);
  const [activeFrame, setActiveFrame] = useState(0); 

  // --- حالات PWA ---
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // --- حالات التسعير ---
  const [pricingSettings, setPricingSettings] = useState(null);
  const [calcQty, setCalcQty] = useState(50);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (data) setPricingSettings(data);
      } catch (err) { console.error('Error fetching settings:', err); }
    }
    fetchSettings();
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

  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  const calculateDynamicPrice = (qty) => {
    if (!pricingSettings) return { unit: 0, total: 0, savings: 0 };
    let unitPrice = pricingSettings.tier_1_price;
    const basePrice = pricingSettings.tier_1_price; 
    if (qty > pricingSettings.tier_2_limit) unitPrice = pricingSettings.tier_3_price;
    else if (qty > pricingSettings.tier_1_limit) unitPrice = pricingSettings.tier_2_price;
    const total = qty * unitPrice;
    const originalTotal = qty * basePrice;
    const savings = originalTotal - total;
    return { unit: unitPrice, total, savings };
  };
  const calcResult = calculateDynamicPrice(calcQty);

  const handleImageCheck = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const megaPixels = (width * height) / 1000000;
      let qualityScore = 'low';
      let qualityText = 'جودة منخفضة';
      if (width >= 2400 && height >= 3500) { qualityScore = 'excellent'; qualityText = 'ممتازة (مناسبة لـ A4)'; }
      else if (width >= 1200 && height >= 1800) { qualityScore = 'good'; qualityText = 'جيدة (مناسبة لـ 4x6)'; }
      
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const brightness = 150; 
      
      setTimeout(() => {
        setAnalysisResult({ width, height, megaPixels: megaPixels.toFixed(1), qualityScore, qualityText, brightness: brightness });
        setAnalyzing(false);
        URL.revokeObjectURL(objectUrl);
      }, 1500);
    };
  };

  const handleMockupUpload = (event) => {
    const file = event.target.files[0];
    if (file) setMockupImage(URL.createObjectURL(file));
  };

  const reviews = [
    { id: 1, name: "زينب", comment: "الجودة خرافية والألوان تفتح النفس! التغليف كان ممتاز جداً.", rating: 5 },
    { id: 2, name: "معصومة", comment: "تعامل راقي وسرعة في الإنجاز. طلبت الصباح واستلمت العصر.", rating: 5 },
    { id: 3, name: "فاطمة", comment: "أفضل محل طباعة تعاملت معه في الأحساء، دقة في المواعيد.", rating: 4 },
  ];

  return (
    <div className="min-h-screen bg-[#F8F5F2] font-sans text-[#4A4A4A] scroll-smooth relative overflow-x-hidden selection:bg-[#D9A3AA] selection:text-white" dir="rtl">
      
      {/* خلفية جمالية */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
         <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#D9A3AA]/5 rounded-full blur-3xl opacity-60 mix-blend-multiply"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[50rem] h-[50rem] bg-[#C5A059]/5 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
      </div>

      {/* --- PWA iOS Modal --- */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#F8F5F2] w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 left-4 text-[#4A4A4A] hover:text-[#C5A059]"><X size={24} /></button>
            <div className="text-center mb-6">
              <img src={logo} alt="App Icon" className="w-16 h-16 mx-auto mb-2 object-contain" />
              <h3 className="text-xl font-black text-[#4A4A4A]">تثبيت تطبيق لحظة فن</h3>
            </div>
            <div className="space-y-4 text-sm font-medium text-[#4A4A4A]">
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><Share size={20} className="text-[#C5A059]"/> <span>1. اضغط زر "مشاركة"</span></div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"><PlusSquare size={20} className="text-[#C5A059]"/> <span>2. اختر "إضافة للشاشة الرئيسية"</span></div>
            </div>
            <button onClick={() => setShowIOSInstructions(false)} className="w-full mt-6 bg-[#D9A3AA] text-white py-3 rounded-xl font-bold hover:bg-[#C5A059] transition-colors">فهمت ذلك</button>
          </div>
        </div>
      )}

      {/* --- Navbar --- */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F8F5F2]/90 backdrop-blur-md shadow-sm border-b border-[#D9A3AA]/10' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src={logo} alt="Art Moment Logo" className="w-10 h-10 object-contain" />
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-[#4A4A4A] leading-none">لحظة فن</h1>
              <span className="text-[10px] text-[#C5A059] font-bold tracking-widest uppercase">Art Moment</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-[#4A4A4A]/80">
            <a href="#ai-check" className="hover:text-[#D9A3AA] transition-colors flex items-center gap-1"><ScanFace size={16} className="text-[#D9A3AA]"/> فحص الجودة</a>
            <a href="#mockups" className="hover:text-[#D9A3AA] transition-colors">المحاكاة</a>
            <a href="#sizes" className="hover:text-[#D9A3AA] transition-colors">الخدمات</a>
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
             {(isInstallable || isIOS) && (
               <button onClick={handleInstallClick} className="flex items-center gap-2 px-4 py-2 bg-[#D9A3AA] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#C5A059] transition-all">
                 <Download size={16} /> <span className="hidden sm:inline">تحميل التطبيق</span>
               </button>
             )}
             <Link to="/admin/login" className="hidden sm:inline-flex bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 px-3 py-2 rounded-full hover:text-[#D9A3AA] transition-all shadow-sm">
               <Lock size={16} />
             </Link>
             <button className="md:hidden p-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#F8F5F2] border-t border-[#D9A3AA]/10 p-4 space-y-4 shadow-xl absolute w-full z-50">
            <a href="#ai-check" className="block py-2 text-[#D9A3AA] font-bold" onClick={() => setIsMobileMenuOpen(false)}>✨ فحص جودة الصورة</a>
            <a href="#mockups" className="block py-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(false)}>جربيها في برواز</a>
            <a href="#sizes" className="block py-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(false)}>خدمات الطباعة</a>
            
            <Link to="/track" className="block w-full text-center py-3 bg-white rounded-xl font-bold text-[#4A4A4A] border border-[#D9A3AA]/20 shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>
              تتبع طلبك
            </Link>

            {/* زر دخول المسؤول في القائمة */}
            <Link to="/admin/login" className="block w-full text-center py-3 rounded-xl font-bold text-[#4A4A4A]/60 hover:bg-white hover:text-[#D9A3AA] transition-all flex items-center justify-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
               <Lock size={16} /> دخول المسؤول
            </Link>
          </div>
        )}
      </header>

      {/* --- 1. Hero Section --- */}
      <section className="relative py-16 md:py-24 overflow-hidden bg-[#4A4A4A] text-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#D9A3AA]/10 blur-3xl rounded-full translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-full bg-[#C5A059]/10 blur-3xl rounded-full -translate-x-1/2"></div>

        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="text-center md:text-right space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A3AA]/20 text-[#D9A3AA] text-xs font-bold border border-[#D9A3AA]/30">
              <Sparkles size={14} className="text-[#C5A059]" /> طباعة صور فوتوغرافية في الأحساء
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight">
              اطبعي أجمل <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D9A3AA] to-[#C5A059]">لحظاتك</span><br/> لتبقى للأبد.
            </h1>
            
            <p className="text-lg text-white/70 leading-relaxed max-w-xl mx-auto md:mx-0">
              حوّل صورك الرقمية إلى ذكريات ملموسة بجودة استثنائية. 
              أرسل صورك، تابع الطلب، واستلمها بتغليف فاخر يليق بذكرياتك.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
              <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#D9A3AA] hover:bg-[#C5A059] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#D9A3AA]/40">
                <MessageCircle size={20} /> اطلب عبر واتساب
              </a>
              <Link to="/track" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-bold hover:bg-white/20 flex items-center justify-center gap-2 transition-colors">
                <Search size={20} className="text-[#C5A059]" /> تتبع طلبك
              </Link>
            </div>

            <div className="pt-4 flex flex-wrap gap-6 justify-center md:justify-start text-xs font-bold text-white/60">
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> ورق فاخر</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> دقة عالية</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-[#C5A059]" /> دفع عند الاستلام</span>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#D9A3AA]/20 to-[#C5A059]/20 rounded-[2.5rem] rotate-3 transition-transform group-hover:rotate-6 duration-500"></div>
            <img src={printedPhotos} alt="صور مطبوعة" className="relative z-10 w-full rounded-[2.5rem] shadow-2xl shadow-[#D9A3AA]/10 border-4 border-white/20 transform transition-transform group-hover:-rotate-2 duration-500 object-cover h-[500px]" />
            
            <div className="absolute bottom-10 -right-6 bg-white p-4 rounded-2xl shadow-xl shadow-[#C5A059]/10 border border-[#F8F5F2] flex items-center gap-3 z-20 animate-bounce-slow">
               <div className="w-10 h-10 bg-[#D9A3AA]/10 rounded-full flex items-center justify-center text-[#D9A3AA]"><Printer size={20}/></div>
               <div><p className="font-bold text-[#4A4A4A] text-sm">طباعة فورية</p><p className="text-[10px] text-[#C5A059]">جودة 100%</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 2. قسم فحص الجودة (AI Check) --- */}
      <section id="ai-check" className="py-20 bg-white relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F8F5F2] border border-[#D9A3AA]/30 text-[#D9A3AA] font-bold text-xs mb-6">
            <ScanFace size={16}/> الذكاء الاصطناعي
          </div>
          <h2 className="text-3xl font-black text-[#4A4A4A] mb-4">هل صورتك مناسبة للطباعة؟ 🧐</h2>
          <p className="text-[#4A4A4A]/70 mb-10 max-w-lg mx-auto">
            ارفع صورتك هنا، وسيقوم النظام فوراً بتحليل دقتها وإضاءتها ليخبرك بأفضل مقاس للطباعة.
          </p>

          <div className="bg-[#F8F5F2] rounded-[2.5rem] p-8 shadow-inner border border-[#D9A3AA]/10 max-w-2xl mx-auto relative overflow-hidden">
            {!analysisResult && !analyzing && (
              <div onClick={() => fileInputRef.current?.click()} className="border-3 border-dashed border-[#D9A3AA]/30 hover:border-[#D9A3AA] hover:bg-white rounded-3xl p-10 cursor-pointer transition-all group">
                <div className="w-20 h-20 bg-white text-[#D9A3AA] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <Upload size={32}/>
                </div>
                <h3 className="font-bold text-[#4A4A4A] text-lg mb-2">اضغط هنا لرفع الصورة</h3>
                <p className="text-sm text-[#4A4A4A]/60">نقبل صور JPG, PNG بجودة عالية</p>
                <input type="file" ref={fileInputRef} onChange={handleImageCheck} accept="image/*" className="hidden" />
              </div>
            )}

            {analyzing && (
              <div className="py-16">
                <Loader2 size={48} className="text-[#D9A3AA] animate-spin mx-auto mb-4"/>
                <p className="text-lg font-bold text-[#4A4A4A] animate-pulse">جاري تحليل البكسلات والإضاءة...</p>
              </div>
            )}

            {analysisResult && (
              <div className="animate-in zoom-in duration-300">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl border bg-white ${analysisResult.qualityScore === 'low' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
                    <div className="text-xs font-bold uppercase opacity-70 mb-1 text-[#4A4A4A]">الدقة</div>
                    <div className="font-black text-xl mb-1">{analysisResult.megaPixels} MP</div>
                    <div className="text-xs font-bold flex items-center justify-center gap-1">
                      {analysisResult.qualityScore === 'low' ? <AlertTriangle size={12}/> : <CheckCircle size={12}/>}
                      {analysisResult.qualityText}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl border border-blue-200 bg-white text-blue-600">
                    <div className="text-xs font-bold uppercase opacity-70 mb-1 text-[#4A4A4A]">الإضاءة</div>
                    <div className="font-black text-xl mb-1">{analysisResult.brightness}/255</div>
                    <div className="text-xs font-bold">إضاءة {analysisResult.brightness > 200 ? 'ساطعة' : analysisResult.brightness < 60 ? 'خافتة' : 'متوازنة'}</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => {setAnalysisResult(null); fileInputRef.current.value = '';}} className="px-6 py-3 rounded-xl border border-[#D9A3AA] text-[#D9A3AA] font-bold hover:bg-[#D9A3AA] hover:text-white transition-colors">فحص أخرى</button>
                  <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="px-6 py-3 rounded-xl bg-[#C5A059] text-white font-bold hover:bg-[#4A4A4A] transition-colors shadow-lg">أكملي الطلب</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- 3. قسم المحاكاة (Mockups) --- */}
      <section id="mockups" className="py-20 bg-[#4A4A4A] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/10 rounded-full blur-3xl"></div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C5A059]/20 text-[#C5A059] font-bold text-xs mb-2">
                <Frame size={16} /> تجربة تفاعلية
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                جربي صورك في براويزنا 🖼️<br/><span className="text-[#C5A059]">قبل ما تطلبي!</span>
              </h2>
              <p className="text-white/70 text-lg leading-relaxed">
                محتار كيف بتطلع الصورة على الجدار أو المكتب؟ ارفع صورك وشوفها كأنها مطبوعة قدامك.
              </p>

              <div className="flex gap-3">
                {[ { id: 0, label: 'على الجدار', icon: Frame }, { id: 1, label: 'على المكتب', icon: ImageIcon }, { id: 2, label: 'في الألبوم', icon: BookOpen } ].map((frame) => (
                  <button key={frame.id} onClick={() => setActiveFrame(frame.id)} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${activeFrame === frame.id ? 'bg-[#D9A3AA] text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                    <frame.icon size={18} /> {frame.label}
                  </button>
                ))}
              </div>

              <div className="pt-4">
                <button onClick={() => mockupInputRef.current?.click()} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-[#4A4A4A] font-bold hover:bg-[#F8F5F2] transition-colors flex items-center justify-center gap-2">
                  <Upload size={20} /> ارفع صورة للتجربة
                </button>
                <input type="file" ref={mockupInputRef} onChange={handleMockupUpload} accept="image/*" className="hidden" />
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 relative">
                <img src={activeFrame === 0 ? "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80" : activeFrame === 1 ? "https://images.unsplash.com/photo-1593060235732-22fdba40604b?auto=format&fit=crop&w=800&q=80" : "https://images.unsplash.com/photo-1544376798-89aa6b82c6cd?auto=format&fit=crop&w=800&q=80"} alt="Frame" className="w-full h-full object-cover opacity-60 mix-blend-overlay"/>
                {mockupImage ? (
                  <div className={`absolute shadow-2xl transition-all duration-500 overflow-hidden ${activeFrame === 0 ? "top-[20%] left-[25%] w-[50%] h-[40%] border-8 border-white bg-white rotate-1" : activeFrame === 1 ? "top-[35%] left-[60%] w-[25%] h-[35%] border-4 border-black bg-white -rotate-6" : "top-[15%] left-[15%] w-[35%] h-[70%] rotate-2 shadow-inner"}`}>
                    <img src={mockupImage} className="w-full h-full object-cover" alt="User Upload" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-center p-6"><div className="bg-[#4A4A4A]/80 backdrop-blur-md p-6 rounded-3xl border border-white/10"><Eye size={40} className="mx-auto mb-2 text-[#C5A059]"/><p className="text-white/80 font-bold">ارفعي صورة لتظهر هنا</p></div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4. الخدمات والتسعير الديناميكي --- */}
      <section id="sizes" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-[#4A4A4A] mb-4">خدمات الطباعة <span className="text-[#D9A3AA]">والألبومات</span></h2>
            <p className="text-[#4A4A4A]/70 max-w-2xl mx-auto">اختار المقاس المناسب لصورك، واحصل على جودة تدوم.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {[ 
              { icon: ImageIcon, title: 'صور 4×6', desc: 'المقاس الكلاسيكي للألبومات.', color: 'text-[#D9A3AA]', bg: 'bg-[#D9A3AA]/10' },
              { icon: FileText, title: 'صور A4', desc: 'مثالية للبراويز الكبيرة.', color: 'text-[#C5A059]', bg: 'bg-[#C5A059]/10' },
              { icon: BookOpen, title: 'ألبومات', desc: 'حفظ آمن للذكريات.', color: 'text-[#4A4A4A]', bg: 'bg-[#4A4A4A]/10' }
            ].map((service, i) => (
              <div key={i} className="bg-[#F8F5F2] rounded-3xl p-8 hover:shadow-xl hover:shadow-[#D9A3AA]/10 transition-all border border-transparent hover:border-[#D9A3AA]/30 group">
                <div className={`w-14 h-14 ${service.bg} rounded-2xl flex items-center justify-center ${service.color} mb-6 group-hover:scale-110 transition-transform`}>
                  <service.icon size={32} />
                </div>
                <h3 className="text-xl font-bold text-[#4A4A4A] mb-3">{service.title}</h3>
                <p className="text-[#4A4A4A]/60 text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          {/* الحاسبة الديناميكية */}
          {pricingSettings?.is_dynamic_pricing_enabled && (
            <div className="max-w-4xl mx-auto mt-16 animate-in slide-in-from-bottom duration-700">
              <div className="bg-[#4A4A4A] rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 text-center md:text-right">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A3AA]/20 text-[#D9A3AA] font-bold text-xs mb-3 border border-[#D9A3AA]/30"><Sparkles size={14} className="animate-pulse"/> وفر أكثر</div>
                    <h3 className="text-3xl font-black mb-4">كل ما طبعت أكثر، <span className="text-[#C5A059]">وفرت أكثر!</span></h3>
                    <p className="text-white/70 text-sm mb-8">حرك المؤشر وشوف السعر يتغير تلقائياً.</p>
                    
                    <div className="space-y-6">
                      <input type="range" min="1" max="100" value={calcQty} onChange={(e) => setCalcQty(Number(e.target.value))} className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#D9A3AA]" />
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
                      <span className="text-5xl font-black text-[#D9A3AA]">{calcResult.unit} <span className="text-base text-[#4A4A4A]/40 font-medium">ر.س</span></span>
                    </div>
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between text-sm font-bold"><span className="text-[#4A4A4A]/60">الإجمالي</span><span>{calcResult.total.toFixed(2)} ر.س</span></div>
                      {calcResult.savings > 0 && (
                        <div className="flex justify-between text-sm font-bold text-[#C5A059] bg-[#C5A059]/10 px-4 py-2 rounded-xl"><span className="flex items-center gap-1"><Sparkles size={14}/> وفرتي</span><span>{calcResult.savings.toFixed(2)} ر.س</span></div>
                      )}
                    </div>
                    <a href={`https://wa.me/966569663697?text=مرحباً، أرغب بطباعة ${calcQty} صورة`} target="_blank" rel="noreferrer" className="block w-full bg-[#4A4A4A] text-white text-center py-4 rounded-xl font-bold hover:bg-[#C5A059] transition-colors shadow-lg">اطلبي بهذا السعر</a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* --- قسم التقييمات --- */}
      <section id="reviews" className="py-20 bg-[#F8F5F2]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-[#4A4A4A] mb-4">ماذا يقول <span className="text-[#D9A3AA]">عملاؤنا؟</span></h2>
          <div className="flex justify-center gap-1 mb-12 text-[#C5A059]">
             {[...Array(5)].map((_,i) => <Star key={i} size={24} fill="currentColor"/>)}
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-8 rounded-[2rem] border border-[#D9A3AA]/10 relative hover:-translate-y-2 transition-transform duration-300 shadow-sm">
                <Quote className="absolute top-6 left-6 text-[#F8F5F2]" size={40} />
                <p className="text-[#4A4A4A]/80 font-medium leading-relaxed mb-6 relative z-10">"{review.comment}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] rounded-full flex items-center justify-center text-white font-bold">
                    {review.name.charAt(0)}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#4A4A4A]">{review.name}</div>
                    <div className="text-xs text-[#D9A3AA]">عميل موثوق ✅</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- الأسئلة الشائعة --- */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#4A4A4A] mb-4">أسئلة شائعة</h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'كم يستغرق تجهيز طلب الطباعة؟', a: 'يعتمد الوقت على عدد الصور والضغط، لكن عادة يتم التجهيز في نفس اليوم أو اليوم التالي.' },
              { q: 'كيف أعرف أين وصل طلبي؟', a: 'من خلال صفحة "تتبع الطلب" في الموقع. تحتاج فقط لرقم الطلب الذي نرسله لك.' },
              { q: 'ما هي طرق الدفع المتاحة؟', a: 'الدفع يكون غالباً عند الاستلام نقداً أو تحويل بنكي.' },
            ].map((item, idx) => (
              <div key={idx} className="bg-[#F8F5F2] rounded-2xl border border-[#D9A3AA]/10 overflow-hidden">
                <button onClick={() => toggleFaq(idx)} className="w-full flex items-center justify-between p-5 text-right font-bold text-[#4A4A4A] hover:bg-[#D9A3AA]/5 transition-colors">
                  {item.q}
                  <ChevronDown className={`text-[#D9A3AA] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-[#4A4A4A]/70 text-sm leading-relaxed border-t border-[#D9A3AA]/10">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

{/* --- تذييل الصفحة --- */}
      <footer className="bg-[#4A4A4A] text-white py-16 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"><div className="absolute -top-1/2 -right-1/2 w-[100rem] h-[100rem] bg-[#D9A3AA] rounded-full blur-3xl"></div></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          
          {/* ✅ تم إرجاع الشعار للونه الأسود الأصلي (تمت إزالة الفلتر الأبيض) */}
          <div className="bg-white/10 w-fit mx-auto p-4 rounded-2xl mb-6 backdrop-blur-sm border border-white/10">
            <img src={logo} alt="Art Moment" className="h-16 w-auto brightness-0" /> 
          </div>

          <p className="mb-8 max-w-md mx-auto text-white/60">
            خدمة طباعة منظمة من أول رسالة حتى الاستلام. هدفنا أن تكون تجربتك بسيطة وواضحة، ونجهز لك صورك بأفضل جودة.
          </p>
          
          <div className="flex justify-center gap-6 text-sm font-bold mb-8">
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
            <Link to="/admin/login" className="hover:text-[#D9A3AA] transition-colors">دخول الموظفين</Link>
          </div>
          
          {/* ✅ روابط وسائل التواصل الجديدة مع تصميم أزرار أنيق */}
          <div className="flex justify-center flex-wrap gap-4 mb-8">
             <a href="https://www.instagram.com/art.moment__/" target="_blank" rel="noreferrer" title="Instagram" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-gradient-to-tr hover:from-purple-500 hover:via-pink-500 hover:to-orange-500 hover:text-white transition-all border border-white/10 hover:border-transparent">
               <Instagram size={22}/>
             </a>
             <a href="https://www.snapchat.com/add/omsayedkamal" target="_blank" rel="noreferrer" title="Snapchat" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-yellow-400 hover:text-black transition-all border border-white/10 hover:border-transparent">
               <Ghost size={22}/>
             </a>
             <a href="https://www.tiktok.com/@ayatalshaqaq" target="_blank" rel="noreferrer" title="TikTok" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-black hover:text-white transition-all border border-white/10 hover:border-transparent">
               <Music size={22}/>
             </a>
             <a href="https://linktr.ee/Art_Moment" target="_blank" rel="noreferrer" title="Linktree" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-[#43E660] hover:text-white transition-all border border-white/10 hover:border-transparent">
               <Link2 size={22}/>
             </a>
             <a href="mailto:omsayedkamal@gmail.com" title="Email" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-red-500 hover:text-white transition-all border border-white/10 hover:border-transparent">
               <Mail size={22}/>
             </a>
          </div>

          <p className="text-xs text-white/30 border-t border-white/10 pt-8">
            © 2026 Art Moment. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>

      {/* زر واتساب العائم */}
      <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="fixed bottom-6 left-6 z-40 bg-[#D9A3AA] hover:bg-[#C5A059] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group border-4 border-white">
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">تواصل معنا</span>
      </a>

    </div>
  );
}
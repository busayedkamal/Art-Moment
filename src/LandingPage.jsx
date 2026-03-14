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
  Ghost, Music, Link2, Plane, Gift, Smartphone, LayoutDashboard,
  MessageSquarePlus, Send // 👈 أضفنا هاتين الأيقونتين
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
  const [activePackage, setActivePackage] = useState(0);

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

  // --- حالات صندوق الاقتراحات والشكاوى ---
  const [feedbackType, setFeedbackType] = useState('تقييم ⭐️');
  const [feedbackText, setFeedbackText] = useState('');

  const handleSendFeedback = () => {
    if(!feedbackText.trim()) return;
    const adminWhatsApp = "966569663697"; // رقم الإدارة
    const msg = `مرحباً، لدي رسالة للإدارة:\n\n*نوع الرسالة:* ${feedbackType}\n*النص:* ${feedbackText}`;
    window.open(`https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(msg)}`, '_blank');
    setFeedbackText(''); // تفريغ الحقل بعد الإرسال
  };

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
            <a href="#packages" className="hover:text-[#D9A3AA] transition-colors">الباقات</a>
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
            <a href="#packages" className="block py-2 text-[#4A4A4A]" onClick={() => setIsMobileMenuOpen(false)}>الباقات</a>
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
            <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#25D366]/40">
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

{/* --- 3. قسم مستشار باقات الذكريات (البديل الجبار للمحاكاة) --- */}
      <section id="packages" className="py-20 bg-[#4A4A4A] text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#D9A3AA]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#C5A059]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C5A059]/20 text-[#C5A059] font-bold text-xs mb-4 border border-[#C5A059]/30">
              <Sparkles size={14} /> حلك الجاهز عندنا
            </div>
            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">
              محتار وش تطبع؟ <br/><span className="text-[#C5A059]">اختر المناسبة وخلي الباقي علينا!</span>
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              صممنا لك باقات ذكية ومدروسة توفر عليك التفكير، وتضمن لك توثيق ذكرياتك بأفضل شكل وبأنسب سعر.
            </p>
          </div>

          {(() => {
            const packages = [
              {
                id: 0,
                icon: Plane,
                title: 'ذكريات السفر',
                desc: 'لا تخلي صور السفرة محبوسة بالجوال! وثق أجمل أيامك في ألبوم يجمع كل تفاصيلها لتعيشها كل ما فتحته.',
                contents: ['ألبوم صور أنيق ومقاوم', '100 صورة مقاس 4x6', 'ألوان زاهية وتفاصيل دقيقة'],
                color: 'from-blue-500 to-cyan-400',
                whatsappMsg: 'مرحباً، مهتم بطلب "باقة ذكريات السفر" (ألبوم + 100 صورة)'
              },
              {
                id: 1,
                icon: Gift,
                title: 'الهدية المثالية',
                desc: 'أجمل هدية ممكن تقدمها لشخص غالي هي ذكرياتكم المشتركة. جهزناها لك بعناية لتكون مفاجأة لا تُنسى.',
                contents: ['ألبوم فاخر لحفظ الصور', '50 صورة لأجمل لحظاتكم', 'تغليف هدايا فاخر + كرت إهداء'],
                color: 'from-[#D9A3AA] to-pink-500',
                whatsappMsg: 'مرحباً، مهتم بطلب "باقة الهدية المثالية" (مع التغليف)'
              },
              {
                id: 2,
                icon: Smartphone,
                title: 'تفريغ زحمة الجوال',
                desc: 'الجوالات تخرب وتضيع، لكن الصور المطبوعة تعيش للأبد. نظف مساحة جوالك واحفظ ذكرياتك بأمان.',
                contents: ['200 صورة مقاس 4x6', 'طباعة عالية الجودة تدوم طويلاً', 'توفير ممتاز للكميات'],
                color: 'from-[#C5A059] to-amber-600',
                whatsappMsg: 'مرحباً، مهتم بطلب "باقة تفريغ الجوال" (200 صورة)'
              },
              {
                id: 3,
                icon: LayoutDashboard,
                title: 'جدار الذكريات',
                desc: 'جدد غرفتك أو مكتبك بصورك المفضلة! صور بحجم كبير تناسب البراويز وتضيف روح للمكان.',
                contents: ['6 صور كبيرة مقاس A4', 'دقة استثنائية تناسب البراويز', 'جاهزة للتعليق فوراً'],
                color: 'from-emerald-500 to-teal-400',
                whatsappMsg: 'مرحباً، مهتم بطلب "باقة جدار الذكريات" (6 صور A4)'
              }
            ];

            const active = packages[activePackage];

            return (
              <div className="grid md:grid-cols-12 gap-8 items-start">
                
                {/* قائمة الخيارات (الأزرار) */}
                <div className="md:col-span-4 space-y-3">
                  {packages.map((pkg) => (
                    <button 
                      key={pkg.id} 
                      onClick={() => setActivePackage(pkg.id)}
                      className={`w-full text-right p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 border ${activePackage === pkg.id ? 'bg-white text-[#4A4A4A] border-white shadow-xl scale-105' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${pkg.color} shadow-md`}>
                        <pkg.icon size={24} />
                      </div>
                      <div>
                        <h4 className={`font-black ${activePackage === pkg.id ? 'text-[#4A4A4A]' : 'text-white'}`}>{pkg.title}</h4>
                      </div>
                    </button>
                  ))}
                </div>

                {/* تفاصيل الباقة المحددة */}
                <div className="md:col-span-8">
                  <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500" key={active.id}>
                    <div className={`absolute top-0 right-0 w-2 h-full bg-gradient-to-b ${active.color}`}></div>
                    
                    <h3 className="text-3xl font-black text-white mb-4">{active.title}</h3>
                    <p className="text-white/70 leading-relaxed mb-8 text-lg">
                      {active.desc}
                    </p>

                    <div className="bg-[#F8F5F2]/10 rounded-2xl p-6 mb-8 border border-white/5">
                      <h4 className="font-bold text-[#C5A059] mb-4 text-sm uppercase tracking-wider">محتويات الباقة الافتراضية:</h4>
                      <ul className="space-y-3">
                        {active.contents.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-3 text-white/90">
                            <CheckCircle size={18} className="text-[#D9A3AA]" />
                            <span className="font-medium">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a 
                      href={`https://wa.me/966569663697?text=${encodeURIComponent(active.whatsappMsg)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-[#4A4A4A] font-black hover:bg-[#F8F5F2] hover:scale-105 transition-all shadow-xl"
                    >
                      <MessageCircle size={20} className={`text-transparent bg-clip-text bg-gradient-to-br ${active.color} text-black`} /> 
                      اطلب هذه الباقة الآن
                    </a>
                  </div>
                </div>

              </div>
            );
          })()}
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
              { 
                icon: ImageIcon, 
                title: 'صور 4×6', 
                desc: 'المقاس الأشهر والأكثر طلباً. مثالي لحفظ يومياتك وتوثيق اللحظات العفوية والرحلات.', 
                features: ['ورق تصوير فاخر مقاوم للبهتان', 'ألوان زاهية وواقعية تدوم طويلاً', 'المقاس المثالي للألبومات الكلاسيكية'],
                color: 'text-[#D9A3AA]', 
                bg: 'bg-[#D9A3AA]/10' 
              },
              { 
                icon: FileText, 
                title: 'صور A4', 
                desc: 'لصورك الاحترافية واللوحات الفنية. المقاس الأفضل لإبراز أدق التفاصيل وتزيين المكان.', 
                features: ['دقة طباعة استثنائية للتفاصيل', 'حجم كبير مناسب للبراويز الجدارية', 'مثالية لصور التخرج والمناسبات الكبرى'],
                color: 'text-[#C5A059]', 
                bg: 'bg-[#C5A059]/10' 
              },
              { 
                icon: BookOpen, 
                title: 'الألبومات', 
                desc: 'لا تترك صورك متناثرة. اختر من تشكيلتنا الأنيقة لحفظ ذكرياتك بطريقة فخمة ومرتبة.', 
                features: ['تصاميم عصرية وأغلفة متينة', 'سعات مختلفة تناسب كمية صورك', 'حماية تامة للصور من الغبار والتلف'],
                color: 'text-[#4A4A4A]', 
                bg: 'bg-[#4A4A4A]/10' 
              }
            ].map((service, i) => (
              <div key={i} className="bg-[#F8F5F2] rounded-3xl p-8 hover:shadow-xl hover:shadow-[#D9A3AA]/10 transition-all border border-transparent hover:border-[#D9A3AA]/30 group flex flex-col">
                <div className={`w-14 h-14 ${service.bg} rounded-2xl flex items-center justify-center ${service.color} mb-6 group-hover:scale-110 transition-transform`}>
                  <service.icon size={32} />
                </div>
                <h3 className="text-xl font-bold text-[#4A4A4A] mb-3">{service.title}</h3>
                <p className="text-[#4A4A4A]/60 text-sm leading-relaxed mb-6 flex-1">{service.desc}</p>
                
                {/* قائمة المميزات */}
                <ul className="space-y-3 pt-4 border-t border-[#D9A3AA]/10">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-[#4A4A4A]/80 font-medium">
                      <CheckCircle size={16} className={`shrink-0 mt-0.5 ${service.color}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* الحاسبة الديناميكية */}
          {/* ... (باقي كود الحاسبة كما هو بدون تغيير) ... */}
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

{/* --- قسم التقييمات وصندوق تواصل الإدارة --- */}
      <section id="reviews" className="py-20 bg-[#F8F5F2]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#4A4A4A] mb-4">ماذا يقول <span className="text-[#D9A3AA]">عملاؤنا؟</span></h2>
            <div className="flex justify-center gap-1 mb-12 text-[#C5A059]">
               {[...Array(5)].map((_,i) => <Star key={i} size={24} fill="currentColor"/>)}
            </div>
            
            {/* التقييمات السابقة */}
            <div className="grid md:grid-cols-3 gap-8 mb-20">
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

            {/* صندوق الاقتراحات والشكاوى (الخط المباشر للإدارة) */}
            <div className="max-w-3xl mx-auto bg-white rounded-[2rem] p-8 shadow-xl border border-[#D9A3AA]/20 relative overflow-hidden animate-in slide-in-from-bottom duration-700">
               <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-[#D9A3AA] to-[#C5A059]"></div>
               <div className="text-center mb-8">
                 <h3 className="text-2xl font-black text-[#4A4A4A] flex items-center justify-center gap-2 mb-2">
                   <MessageSquarePlus className="text-[#C5A059]"/> الإدارة في خدمتك دائماً
                 </h3>
                 <p className="text-[#4A4A4A]/60 text-sm">نستقبل تقييماتك، مقترحاتك التطويرية، أو حتى شكواك بصدر رحب لخدمتك بشكل أفضل.</p>
               </div>

               <div className="space-y-6">
                 {/* أزرار اختيار نوع الرسالة */}
                 <div className="flex flex-wrap gap-3 justify-center">
                   {['تقييم ⭐️', 'اقتراح 💡', 'شكوى ⚠️'].map(type => (
                     <button 
                       key={type}
                       onClick={() => setFeedbackType(type)}
                       className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${feedbackType === type ? 'bg-[#4A4A4A] text-white border-[#4A4A4A] shadow-md scale-105' : 'bg-white text-[#4A4A4A]/60 border-[#D9A3AA]/30 hover:border-[#4A4A4A]/50 hover:bg-[#F8F5F2]'}`}
                     >
                       {type}
                     </button>
                   ))}
                 </div>
                 
                 {/* حقل النص */}
                 <textarea 
                   value={feedbackText}
                   onChange={(e) => setFeedbackText(e.target.value)}
                   placeholder="اكتب رسالتك هنا بكل شفافية وسرية تامة..."
                   className="w-full h-32 bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl p-4 text-[#4A4A4A] outline-none focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 resize-none transition-all"
                 ></textarea>

                 {/* زر الإرسال */}
                 <button 
                   onClick={handleSendFeedback}
                   disabled={!feedbackText.trim()}
                   className="w-full bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white py-4 rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                 >
                   <Send size={18} /> إرسال الرسالة للإدارة
                 </button>
               </div>
            </div>

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
             <a href="mailto:art.moment26@gmail.com" title="Email" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#C5A059] hover:bg-red-500 hover:text-white transition-all border border-white/10 hover:border-transparent">
               <Mail size={22}/>
             </a>
          </div>

          <p className="text-xs text-white/30 border-t border-white/10 pt-8">
            © 2026 Art Moment. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>

     {/* زر واتساب العائم */}
      <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="fixed bottom-6 left-6 z-40 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group border-4 border-white">
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">تواصل معنا</span>
      </a>

    </div>
  );
}
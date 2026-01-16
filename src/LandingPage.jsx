// src/LandingPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, MessageCircle, Image as ImageIcon, CheckCircle, Truck, 
  Printer, Menu, X, ChevronDown, Lock, Star, Quote, BookOpen,
  Upload, AlertTriangle, Loader2, ScanFace, Frame, Eye, Download,
  Share, PlusSquare // أيقونات جديدة لتعليمات الايفون
} from 'lucide-react';
import logo from './assets/logo-art-moment.svg'; 
import printedPhotos from './assets/printed-photos.png';

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // --- حالات فحص الصور بالذكاء الاصطناعي ---
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRef = useRef(null);

  // --- حالات المحاكاة الواقعية ---
  const [mockupImage, setMockupImage] = useState(null);
  const mockupInputRef = useRef(null);
  const [activeFrame, setActiveFrame] = useState(0); 

  // --- حالات تثبيت التطبيق PWA ---
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. الكشف عن إمكانية التثبيت (أندرويد/كمبيوتر)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 2. الكشف عن أجهزة iOS (لأنها لا تدعم الحدث السابق)
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // التحقق مما إذا كان التطبيق ليس مثبتاً بالفعل (وضعية المتصفح)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true); // فتح تعليمات الايفون
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    }
  };
  // ---------------------------------------

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // --- دالة تحليل الصورة ---
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
      let qualityText = 'من الأفضل تحسين الصورة';
      if (width >= 2400 && height >= 3500) { 
        qualityScore = 'excellent';
        qualityText = 'ممتازة (مناسبة لـ A4 و 4x6)';
      } else if (width >= 1200 && height >= 1800) { 
        qualityScore = 'good';
        qualityText = 'جيدة (مناسبة لـ 4x6 فقط)';
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      const sampleSize = 100;
      const imageData = ctx.getImageData(width/2 - sampleSize/2, height/2 - sampleSize/2, sampleSize, sampleSize);
      const data = imageData.data;
      let r, g, b, avg;
      let colorSum = 0;

      for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x];
        g = data[x + 1];
        b = data[x + 2];
        avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
      }

      const brightness = Math.floor(colorSum / (sampleSize * sampleSize));
      let lightingStatus = 'good';
      if (brightness < 60) lightingStatus = 'dark';
      if (brightness > 200) lightingStatus = 'bright';

      setTimeout(() => {
        setAnalysisResult({
          width,
          height,
          megaPixels: megaPixels.toFixed(1),
          qualityScore,
          qualityText,
          lightingStatus,
          brightness
        });
        setAnalyzing(false);
        URL.revokeObjectURL(objectUrl);
      }, 1500);
    };
  };

  const handleMockupUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMockupImage(url);
    }
  };

  const reviews = [
    { id: 1, name: "زينب", comment: "الجودة خرافية والألوان تفتح النفس! التغليف كان ممتاز جداً.", rating: 5 },
    { id: 2, name: "معصومة", comment: "تعامل راقي وسرعة في الإنجاز. طلبت الصباح واستلمت العصر.", rating: 5 },
    { id: 3, name: "فاطمة", comment: "أفضل محل طباعة تعاملت معه في الأحساء، دقة في المواعيد.", rating: 4 },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 scroll-smooth" dir="rtl">
      
      {/* --- نافذة تعليمات iOS --- */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-300">
            <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner">
                <img src={logo} alt="App Icon" className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900">تثبيت تطبيق لحظة فن</h3>
              <p className="text-slate-500 text-sm mt-1">للوصول السريع وتجربة أفضل</p>
            </div>
            <div className="space-y-4 text-sm font-medium text-slate-700">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-blue-500"><Share size={20} /></span>
                <span>1. اضغط على زر "مشاركة" في الأسفل</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-700"><PlusSquare size={20} /></span>
                <span>2. اختر "إضافة إلى الشاشة الرئيسية"</span>
              </div>
            </div>
            <button onClick={() => setShowIOSInstructions(false)} className="w-full mt-6 bg-slate-900 text-white py-3 rounded-xl font-bold">
              فهمت ذلك
            </button>
            {/* سهم يشير للأسفل (لزر المشاركة في سفاري) */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white"></div>
          </div>
        </div>
      )}

      {/* --- شريط التنقل (Navbar) --- */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <img src={logo} alt="Art Moment Logo" className="w-10 h-10" />
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-slate-900 leading-none">لحظة فن</h1>
              <span className="text-[10px] text-slate-500 font-bold tracking-wider">Art Moment</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#ai-check" className="text-fuchsia-600 font-bold hover:text-fuchsia-800 transition-colors flex items-center gap-1"><ScanFace size={16}/> فحص الصورة</a>
            <a href="#mockups" className="hover:text-slate-900 transition-colors">المحاكاة</a>
            <a href="#services" className="hover:text-slate-900 transition-colors">الخدمات</a>
            <Link to="/track" className="hover:text-slate-900 transition-colors">تتبع الطلب</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
             {/* زر التثبيت (يظهر للجوال والكمبيوتر إذا كان متاحاً) */}
             {(isInstallable || isIOS) && (
               <button 
                 onClick={handleInstallClick}
                 className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg hover:shadow-fuchsia-500/30 transition-all animate-pulse"
               >
                 <Download size={16} />
                 <span className="hidden sm:inline">تحميل التطبيق</span>
                 <span className="sm:hidden">تثبيت</span>
               </button>
             )}

             <Link to="/track" className="hidden sm:inline-flex text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors">تتبع الطلب</Link>
             <Link to="/admin/login" className="hidden sm:inline-flex bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
               <Lock size={16} />
             </Link>

             <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* قائمة الجوال */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-4 space-y-4 shadow-lg animate-in slide-in-from-top-5">
            <a href="#ai-check" className="block py-2 text-fuchsia-600 font-bold" onClick={() => setIsMobileMenuOpen(false)}>✨ فحص جودة الصورة</a>
            <a href="#mockups" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>جربيها في برواز</a>
            <a href="#services" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>خدمات الطباعة</a>
            <a href="#sizes" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>المقاسات</a>
            <Link to="/track" className="block w-full text-center py-3 bg-slate-100 rounded-xl font-bold text-slate-700" onClick={() => setIsMobileMenuOpen(false)}>تتبع طلبك</Link>
            <Link to="/admin/login" className="block w-full text-center py-3 border border-slate-200 rounded-xl font-bold text-slate-500 text-xs" onClick={() => setIsMobileMenuOpen(false)}>دخول الموظفين</Link>
          </div>
        )}
      </header>

      {/* --- 2. القسم الرئيسي (Hero) --- */}
      <header className="relative bg-slate-900 overflow-hidden py-16 md:py-24">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-fuchsia-500/5 blur-3xl rounded-full translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-full bg-blue-500/5 blur-3xl rounded-full -translate-x-1/2"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            <div className="text-center md:text-right space-y-8">
              <div className="flex flex-col items-center md:items-start gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 text-xs font-bold border border-fuchsia-500/20">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></span>
                  طباعة صور فوتوغرافية في الأحساء
                </div>
                <span className="inline-block py-1 px-3 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20">
                   ✨ عرض خاص: استخدم كود <span className="text-white font-mono"></span> لخصم إضافي
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.8] md:leading-loose">
                اطبعي أجمل لحظاتك مع <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-emerald-300">لحظة فن | Art-Moment</span>
              </h1>
              
              <p className="text-lg text-slate-400 leading-relaxed max-w-xl mx-auto md:mx-0">
                طباعة صور مقاس 4×6 و A4 بجودة عالية، ألوان زاهية، وتفاصيل واضحة. 
                أرسلي صورك عبر تيليجرام، تابعي حالة الطلب أونلاين، واستلميها جاهزة مع تغليف فاخر و بالتنسيق على الوقت اللي يناسبك.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-slate-500/20">
                  <MessageCircle size={20} /> تواصلي معنا عبر وتساب
                </a>
                <Link to="/track" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 flex items-center justify-center gap-2 transition-colors">
                  <Search size={20} /> تتبعي طلبك
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start text-xs text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-emerald-500" /> تجهيز سريع للطلبات</span>
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-emerald-500" /> مراجعة دقة الصور</span>
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-emerald-500" /> دفع عند الاستلام</span>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-slate-800 border border-slate-700 overflow-hidden shadow-2xl relative group">
                <img src={printedPhotos} alt="صور مطبوعة" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 right-6 text-white">
                  <p className="font-bold text-lg">صور فوتوغرافية مطبوعة</p>
                  <p className="text-sm text-slate-300">نهتم بتوازن الألوان والحدة في كل صورة</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- قسم فحص الجودة بالذكاء الاصطناعي --- */}
      <section id="ai-check" className="py-20 bg-gradient-to-br from-fuchsia-50 to-purple-50 border-b border-fuchsia-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-fuchsia-200 text-fuchsia-600 font-bold text-xs mb-6 shadow-sm">
            <ScanFace size={16} className="animate-pulse"/> جديد! الذكاء الاصطناعي لفحص الصور
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">هل صورتك مناسبة للطباعة؟ 🧐</h2>
          <p className="text-slate-600 mb-10 max-w-lg mx-auto">
            ارفعي صورتك هنا، وسيقوم النظام فوراً بتحليل دقتها وإضاءتها ليخبرك بأفضل مقاس للطباعة قبل الطلب.
          </p>

          <div className="bg-white rounded-3xl p-8 shadow-xl border border-white/50 max-w-2xl mx-auto relative overflow-hidden">
            {!analysisResult && !analyzing && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-3 border-dashed border-slate-200 hover:border-fuchsia-400 hover:bg-fuchsia-50/50 rounded-2xl p-10 cursor-pointer transition-all group"
              >
                <div className="w-20 h-20 bg-fuchsia-100 text-fuchsia-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32}/>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">اضغطي هنا لرفع الصورة</h3>
                <p className="text-sm text-slate-400">نقبل صور JPG, PNG بجودة عالية</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageCheck} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            )}

            {analyzing && (
              <div className="py-16">
                <Loader2 size={48} className="text-fuchsia-600 animate-spin mx-auto mb-4"/>
                <p className="text-lg font-bold text-slate-700 animate-pulse">جاري تحليل البكسلات والإضاءة...</p>
              </div>
            )}

            {analysisResult && (
              <div className="animate-in zoom-in duration-300">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl border-2 ${analysisResult.qualityScore === 'low' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <div className="text-xs font-bold uppercase opacity-70 mb-1">دقة الصورة</div>
                    <div className="font-black text-xl mb-1">{analysisResult.megaPixels} MP</div>
                    <div className="text-xs font-medium flex items-center justify-center gap-1">
                      {analysisResult.qualityScore === 'low' ? <AlertTriangle size={14}/> : <CheckCircle size={14}/>}
                      {analysisResult.qualityText}
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl border-2 ${analysisResult.lightingStatus === 'good' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                    <div className="text-xs font-bold uppercase opacity-70 mb-1">الإضاءة</div>
                    <div className="font-black text-xl mb-1">{analysisResult.brightness}/255</div>
                    <div className="text-xs font-medium">
                      {analysisResult.lightingStatus === 'good' ? 'إضاءة متوازنة ممتازة' : (analysisResult.lightingStatus === 'dark' ? 'الصورة مظلمة قليلاً' : 'الصورة ساطعة جداً')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button 
                    onClick={() => {setAnalysisResult(null); fileInputRef.current.value = '';}}
                    className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                  >
                    فحص صورة أخرى
                  </button>
                  <a 
                    href="https://wa.me/966569663697" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-6 py-3 rounded-xl bg-fuchsia-600 text-white font-bold hover:bg-fuchsia-700 transition-colors shadow-lg shadow-fuchsia-200"
                  >
                    أكملي الطلب الآن
                  </a>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-6">* ملاحظة: يتم التحليل على جهازك فوراً لضمان الخصوصية، لا يتم رفع الصور لسيرفراتنا في هذه المرحلة.</p>
        </div>
      </section>

      {/* --- قسم المحاكاة الواقعية (Live Mockups) --- */}
      <section id="mockups" className="py-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* الجهة اليمنى: الشرح والأزرار */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs mb-2">
                <Frame size={16} /> تجربة تفاعلية
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                جربي صورك في براويزنا 🖼️<br/>
                <span className="text-slate-400">قبل ما تطلبي!</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                محتارة كيف بتطلع الصورة على الجدار أو المكتب؟<br/>
                ارفعي صورتك وشوفيها كأنها مطبوعة قدامك الآن.
              </p>

              {/* أزرار اختيار القوالب */}
              <div className="flex gap-3">
                {[
                  { id: 0, label: 'على الجدار', icon: Frame },
                  { id: 1, label: 'على المكتب', icon: ImageIcon }, 
                  { id: 2, label: 'في الألبوم', icon: BookOpen },
                ].map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => setActiveFrame(frame.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${
                      activeFrame === frame.id 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <frame.icon size={18} /> {frame.label}
                  </button>
                ))}
              </div>

              {/* زر رفع الصورة للمحاكاة */}
              <div className="pt-4">
                <button 
                  onClick={() => mockupInputRef.current?.click()}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={20} /> ارفعي صورة للتجربة
                </button>
                <input 
                  type="file" 
                  ref={mockupInputRef} 
                  onChange={handleMockupUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>

            {/* الجهة اليسرى: منطقة العرض (Canvas) */}
            <div className="relative">
              <div className="aspect-square bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 relative">
                
                {/* الخلفيات */}
                <img 
                  src={
                    activeFrame === 0 ? "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80" : // Wall
                    activeFrame === 1 ? "https://images.unsplash.com/photo-1593060235732-22fdba40604b?auto=format&fit=crop&w=800&q=80" : // Desk
                    "https://images.unsplash.com/photo-1544376798-89aa6b82c6cd?auto=format&fit=crop&w=800&q=80" // Album
                  }
                  alt="Frame Background"
                  className="w-full h-full object-cover opacity-60"
                />

                {/* الصورة المرفوعة (يتم دمجها) */}
                {mockupImage ? (
                  <div 
                    className={`absolute shadow-2xl transition-all duration-500 overflow-hidden ${
                      activeFrame === 0 ? "top-[20%] left-[25%] w-[50%] h-[40%] border-8 border-white bg-white rotate-1" : // Wall positioning
                      activeFrame === 1 ? "top-[35%] left-[60%] w-[25%] h-[35%] border-4 border-black bg-white -rotate-6" : // Desk positioning
                      "top-[15%] left-[15%] w-[35%] h-[70%] rotate-2 shadow-inner" // Album positioning
                    }`}
                  >
                    <img src={mockupImage} className="w-full h-full object-cover" alt="User Upload" />
                    {/* لمعة زجاجية */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-50 pointer-events-none"></div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 backdrop-blur-md p-6 rounded-2xl text-center border border-white/10">
                      <Eye size={40} className="mx-auto mb-2 text-emerald-400 opacity-80"/>
                      <p className="text-slate-300 font-medium">ارفعي صورة لتظهر هنا</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* تلميح صغير */}
              <div className="absolute -bottom-6 right-6 bg-emerald-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full rotate-3 shadow-lg">
                تجربة حية! ✨
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- 3. قسم الخدمات والمقاسات --- */}
      <section id="sizes" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">خدمات الطباعة والألبومات</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              اختاري المقاس المناسب لصورك، و احصلي على ألبوم أنيق يحفظ ذكرياتك لسنوات طويلة.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">طباعة صور مقاس 4×6</h3>
              <p className="text-slate-500 leading-relaxed mb-6 text-sm">
                صور فوتوغرافية كلاسيكية تناسب الألبومات والإطارات الصغيرة. نستخدم ورق طباعة مخصص للصور مع ألوان زاهية لتبقى كل صورة محتفظة بجمال اللحظة.
                <br /><br />
                مثالية لصور العائلة، الرحلات، والمناسبات اليومية.
              </p>
              <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg inline-block">
                مثالي للألبومات
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">طباعة صور مقاس A4</h3>
              <p className="text-slate-500 leading-relaxed mb-6 text-sm">
                مقاس أكبر يعرض التفاصيل بوضوح أعلى، مناسب للتعليق على الجدار، أو وضعه في براويز كبيرة، أو تقديمه كهدية مميزة.
                <br /><br />
                نهتم بقص الصورة وضبطها قبل الطباعة قدر الإمكان حتى تظهر متوازنة.
              </p>
              <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-block">
                مثالي للبراويز الكبيرة
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <BookOpen size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">توفير ألبومات صور</h3>
              <p className="text-slate-500 leading-relaxed mb-6 text-sm">
                نقدم تشكيلة فاخرة من الألبومات لحفظ ذكرياتكم بأمان. متوفرة بسعات متعددة تناسب الجميع: <span className="font-bold text-slate-700">100، 200، 300 وحتى 600 صورة</span>.
                <br /><br />
                تتميز بتصاميم أنيقة عصرية، وجودة عالية تحمي الصور من التلف، وبأسعار تناسب ميزانيتكم.
              </p>
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg inline-block">
                حفظ آمن للذكريات
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- 4. كيف تتم الخدمة (Steps) --- */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">كيف تتم عملية الطباعة؟</h2>
            <p className="text-slate-500">خطوات بسيطة وواضحة من أول رسالة إلى استلام الصور جاهزة.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { id: 1, icon: MessageCircle, title: 'إرسال الصور', desc: 'ترسلي الصور عبر تيليجرام مع تحديد المقاس المطلوب.' },
              { id: 2, icon: CheckCircle, title: 'تأكيد الطلب', desc: 'نراجع الصور سريعاً، نوضح لك أي ملاحظات ونؤكد الوقت.' },
              { id: 3, icon: Printer, title: 'الطباعة والتجهيز', desc: 'نطبع الصور باستخدام ورق مخصص للصور عالي الجودة.' },
              { id: 4, icon: Truck, title: 'الاستلام والتقييم', desc: 'تستلمي الطلب في الموعد المحدد، وتقدري تشاركينا رأيك.' },
            ].map((step) => (
              <div key={step.id} className="text-center group">
                <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors mb-6 relative">
                  <step.icon size={28} />
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 text-white rounded-full text-xs flex items-center justify-center font-bold border-2 border-white">
                    {step.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- قسم التقييمات --- */}
      <section id="reviews" className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">ماذا يقول عملاؤنا؟</h2>
          <p className="text-slate-500 mb-12">نفخر بخدمة عملاء الأحساء وتقديم أفضل جودة طباعة.</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-8 rounded-3xl border border-slate-200 relative hover:-translate-y-2 transition-transform duration-300 shadow-sm">
                <Quote className="absolute top-6 left-6 text-slate-100" size={40} />
                <div className="flex gap-1 mb-4 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill={i < review.rating ? "currentColor" : "none"} className={i >= review.rating ? "text-slate-300" : ""} />
                  ))}
                </div>
                <p className="text-slate-700 font-medium leading-relaxed mb-6">"{review.comment}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                    {review.name.charAt(0)}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{review.name}</div>
                    <div className="text-xs text-slate-400">عميل موثوق ✅</div>
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
            <h2 className="text-3xl font-bold text-slate-900 mb-4">أسئلة شائعة</h2>
            <p className="text-slate-500">بعض النقاط التي تُسأل كثيراً من عملاء لحظة فن.</p>
          </div>

          <div className="space-y-4">
            {[
              { q: 'كم يستغرق تجهيز طلب الطباعة؟', a: 'يعتمد الوقت على عدد الصور والضغط، لكن عادة يتم التجهيز في نفس اليوم أو اليوم التالي.' },
              { q: 'كيف أعرف أين وصل طلبي؟', a: 'من خلال صفحة "تتبع الطلب" في الموقع. تحتاج فقط لرقم الطلب الذي نرسله لك.' },
              { q: 'ما هي طرق الدفع المتاحة؟', a: 'الدفع يكون غالباً عند الاستلام نقداً أو تحويل بنكي. بعض الطلبات الكبيرة قد تتطلب عربوناً.' },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <button onClick={() => toggleFaq(idx)} className="w-full flex items-center justify-between p-5 text-right font-bold text-slate-800 hover:bg-slate-100 transition-colors">
                  {item.q}
                  <ChevronDown className={`text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-slate-500 text-sm leading-relaxed border-t border-slate-200">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- تذييل الصفحة --- */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <img src={logo} alt="Art Moment" className="h-16 w-auto mx-auto mb-6" /> 
          <p className="mb-8 max-w-md mx-auto">
            خدمة طباعة منظمة من أول رسالة حتى الاستلام. هدفنا أن تكون تجربتك بسيطة وواضحة، ونجهز لك صورك بأفضل جودة.
          </p>
          <div className="flex justify-center gap-6 text-sm font-medium mb-8">
            <Link to="/track" className="hover:text-white transition-colors">تتبع الطلب</Link>
            <Link to="/admin/login" className="hover:text-white transition-colors">دخول الموظفين</Link>
          </div>
          <p className="text-xs text-slate-600">
            © 2025 Art Moment. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>

      {/* زر واتساب العائم */}
      <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="fixed bottom-6 left-6 z-40 bg-fuchsia-500 text-white p-4 rounded-full shadow-xl hover:bg-gradient-to-b from-fuchsia-600 to-purple-600 hover:scale-110 transition-all flex items-center gap-2 group">
        <MessageCircle size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold text-sm">تواصل عبر واتساب</span>
      </a>

    </div>
  );
}
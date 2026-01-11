// src/LandingPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  MessageCircle, 
  Image as ImageIcon, 
  CheckCircle, 
  Truck, 
  Printer, 
  Menu, 
  X, 
  ChevronDown, 
  Lock,
  Star,    // أيقونة جديدة للتقييم
  Quote    // أيقونة جديدة للاقتباس
} from 'lucide-react';
import logo from './assets/logo-art-moment.svg'; 

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // بيانات التقييمات (إضافة جديدة)
  const reviews = [
    { id: 1, name: "زينب", comment: "الجودة خرافية والألوان تفتح النفس! التغليف كان ممتاز جداً.", rating: 5 },
    { id: 2, name: "معصومة", comment: "تعامل راقي وسرعة في الإنجاز. طلبت الصباح واستلمت العصر.", rating: 5 },
    { id: 3, name: "فاطمة", comment: "أفضل محل طباعة تعاملت معه في الأحساء، دقة في المواعيد.", rating: 4 },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 scroll-smooth" dir="rtl">
      
      {/* --- 1. شريط التنقل (Navbar) --- */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* الشعار - تم التحديث لعرض الصورة بدلاً من الحرف */}
            <div className="flex items-center gap-3">
              <img src={logo} alt="Art Moment" className="h-10 w-auto" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Art Moment</h1>
                <p className="text-[10px] text-slate-500 tracking-wider">Printing & Painting</p>
              </div>
            </div>

            {/* روابط الكمبيوتر */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#services" className="hover:text-fuchsia-600 transition-colors">خدمات الطباعة</a>
              <a href="#sizes" className="hover:text-fuchsia-600 transition-colors">المقاسات</a>
              <a href="#reviews" className="hover:text-fuchsia-600 transition-colors">آراء العملاء</a> {/* رابط جديد */}
              <a href="#how-it-works" className="hover:text-fuchsia-600 transition-colors">كيف تتم الخدمة؟</a>
              <a href="#faq" className="hover:text-fuchsia-600 transition-colors">الأسئلة الشائعة</a>
            </div>

            {/* أزرار الإجراءات */}
            <div className="hidden md:flex items-center gap-3">
              <Link 
                to="/track" 
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Search size={18} />
                تتبع طلبك
              </Link>
              <Link 
                to="/admin/login" 
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <Lock size={16} />
                دخول
              </Link>
            </div>

            {/* زر القائمة للجوال */}
            <button 
              className="md:hidden p-2 text-slate-600"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* قائمة الجوال المنسدلة */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-4 space-y-4 shadow-lg">
            <a href="#services" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>خدمات الطباعة</a>
            <a href="#sizes" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>المقاسات</a>
            <a href="#reviews" className="block py-2 text-slate-600 font-medium" onClick={() => setIsMobileMenuOpen(false)}>آراء العملاء</a>
            <Link to="/track" className="block w-full text-center py-3 bg-slate-100 rounded-xl font-bold text-slate-700" onClick={() => setIsMobileMenuOpen(false)}>
              تتبع طلبك
            </Link>
          </div>
        )}
      </nav>

      {/* --- 2. القسم الرئيسي (Hero) --- */}
      <header className="relative bg-slate-900 overflow-hidden py-16 md:py-24">
        {/* خلفية جمالية */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-fuchsia-500/5 blur-3xl rounded-full translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-full bg-blue-500/5 blur-3xl rounded-full -translate-x-1/2"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* النص والأزرار */}
            <div className="text-center md:text-right space-y-8">
              
              {/* تحديث: إضافة إشعار العروض والكوبونات */}
              <div className="flex flex-col items-center md:items-start gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 text-xs font-bold border border-fuchsia-500/20">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></span>
                  طباعة صور فوتوغرافية في الأحساء
                </div>
                <span className="inline-block py-1 px-3 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20">
                   ✨ عرض خاص: استخدم كود <span className="text-white font-mono"></span> لخصم إضافي
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
                اطبع أجمل لحظاتك مع <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-emerald-300">لحظة فن | Art-Moment</span>
              </h1>
              
              <p className="text-lg text-slate-400 leading-relaxed max-w-xl mx-auto md:mx-0">
                طباعة صور مقاس 4×6 و A4 بجودة عالية، ألوان زاهية، وتفاصيل واضحة. 
                أرسل صورك عبر تيليجرام، تابع حالة الطلب أونلاين، واستلمها جاهزة مع تغليف فاخر و بالتنسيق على الوقت اللي يناسبك.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                <a 
                  href="https://wa.me/966569663697" // ضع رقم الواتساب هنا
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-slate-400 text-slate-900 font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-slate-500/20"
                >
                  <MessageCircle size={20} />
                  تواصلي معنا عبر وتساب
                </a>
                <Link 
                  to="/track"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 flex items-center justify-center gap-2 transition-colors"
                >
                  <Search size={20} />
                  تتبع الطلب
                </Link>
              </div>

              {/* ميزات سريعة */}
              <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start text-xs text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-fuchsia-500" /> تجهيز سريع للطلبات</span>
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-fuchsia-500" /> مراجعة دقة الصور</span>
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-fuchsia-500" /> دفع عند الاستلام</span>
              </div>
            </div>

            {/* الصورة الجمالية */}
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-slate-800 border border-slate-700 overflow-hidden shadow-2xl relative group">
                <img 
                  src="https://images.unsplash.com/photo-1552168324-d612d77725e3?q=80&w=1000&auto=format&fit=crop" 
                  alt="صور مطبوعة" 
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                />
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

      {/* --- 3. قسم المقاسات (Sizes) --- */}
      <section id="sizes" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">مقاسات الطباعة المتوفرة</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              اختر المقاس المناسب لاستخدامك، وسنحرص على أن تكون النتيجة بجودة تليق بذكرياتك.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* بطاقة A4 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">طباعة صور مقاس A4</h3>
              <p className="text-slate-500 leading-relaxed mb-6">
                مقاس أكبر يعرض التفاصيل بوضوح أعلى، مناسب للتعليق على الجدار، أو وضعه في براويز كبيرة، أو تقديمه كهدية مميزة.
                <br /><br />
                نهتم بقص الصورة وضبطها قبل الطباعة قدر الإمكان حتى تظهر متوازنة.
              </p>
              <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-block">
                مثالي للبراويز الكبيرة
              </div>
            </div>

            {/* بطاقة 4x6 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">طباعة صور مقاس 4×6</h3>
              <p className="text-slate-500 leading-relaxed mb-6">
                صور فوتوغرافية كلاسيكية تناسب الألبومات والإطارات الصغيرة. نستخدم ورق طباعة مخصص للصور مع ألوان زاهية لتبقى كل صورة محتفظة بجمال اللحظة.
                <br /><br />
                مثالية لصور العائلة، الرحلات، والمناسبات اليومية.
              </p>
              <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg inline-block">
                مثالي للألبومات
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
              { id: 1, icon: MessageCircle, title: 'إرسال الصور', desc: 'ترسل الصور عبر تيليجرام مع تحديد المقاس المطلوب.' },
              { id: 2, icon: CheckCircle, title: 'تأكيد الطلب', desc: 'نراجع الصور سريعاً، نوضح لك أي ملاحظات ونؤكد الوقت.' },
              { id: 3, icon: Printer, title: 'الطباعة والتجهيز', desc: 'نطبع الصور باستخدام ورق مخصص للصور عالي الجودة.' },
              { id: 4, icon: Truck, title: 'الاستلام والتقييم', desc: 'تستلم الطلب في الموعد المحدد، وتقدر تشاركنا رأيك.' },
            ].map((step) => (
              <div key={step.id} className="text-center group">
                <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-fuchsia-500 group-hover:text-white transition-colors mb-6 relative">
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

      {/* --- إضافة جديدة: قسم التقييمات (Reviews) --- */}
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

      {/* --- 5. الأسئلة الشائعة (FAQ) --- */}
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
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 text-right font-bold text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-slate-500 text-sm leading-relaxed border-t border-slate-200">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- 6. تذييل الصفحة (Footer) --- */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <img src={logo} alt="Art Moment" className="h-16 w-auto mx-auto mb-6" /> {/* الشعار */}
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
      <a 
        href="https://wa.me/966569663697" // ضع رقم الواتساب هنا
        target="_blank" 
        rel="noreferrer"
        className="fixed bottom-6 left-6 z-40 bg-fuchsia-500 text-white p-4 rounded-full shadow-xl hover:bg-gradient-to-b from-fuchsia-600 to-purple-600 hover:scale-110 transition-all flex items-center gap-2 group"
      >
        <MessageCircle size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold text-sm">
          تواصل عبر واتساب
        </span>
      </a>

    </div>
  );
}
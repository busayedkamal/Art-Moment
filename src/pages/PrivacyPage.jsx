// src/pages/PrivacyPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, FileText, ChevronDown,
  Lock, Trash2, Eye, Edit3, HelpCircle,
  AlertCircle, ShoppingBag, Scale, Phone, Mail, MapPin,
  ArrowRight, Users, CreditCard, CheckCircle, Star
} from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';

// ─── مكوّن القسم القابل للطي ─────────────────────────────────────────────────
function Section({ id, icon: Icon, title, number, accent = 'pink', children }) {
  const [open, setOpen] = useState(true);
  const accentColor = accent === 'gold' ? '#C5A059' : '#D9A3AA';
  const accentBg    = accent === 'gold' ? 'bg-[#C5A059]/10 border-[#C5A059]/20' : 'bg-[#D9A3AA]/10 border-[#D9A3AA]/20';

  return (
    <div id={id} className="bg-white rounded-3xl shadow-sm border border-[#4A4A4A]/8 overflow-hidden scroll-mt-28">
      {/* رأس القسم */}
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col w-full p-4 gap-3 text-right hover:bg-[#F8F5F2]/60 transition-colors"
      >
        {/* الصف الأول: العنوان كامل العرض */}
        <h2 className="w-full text-base md:text-lg font-black text-[#4A4A4A] leading-snug">{title}</h2>

        {/* الصف الثاني: الأيقونات موزعة */}
        <div className="flex w-full items-center justify-between border-t border-[#D9A3AA]/10 pt-3 mt-1">
          {/* رقم القسم — يمين */}
          <div
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shadow-sm"
            style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})` }}
          >
            {number}
          </div>

          {/* أيقونة القسم — وسط */}
          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${accentBg}`}>
            <Icon size={16} style={{ color: accentColor }} />
          </div>

          {/* مؤشر الفتح/الإغلاق — يسار */}
          <div className="shrink-0 text-[#D9A3AA]">
            <ChevronDown size={20} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* المحتوى */}
      {open && (
        <div className="px-6 md:px-8 pb-8 border-t border-[#4A4A4A]/6">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── مكوّن بند داخل قسم ──────────────────────────────────────────────────────
function SubSection({ icon: Icon, title, children, accent = 'pink' }) {
  const color = accent === 'gold' ? '#C5A059' : '#D9A3AA';
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} style={{ color }} className="shrink-0" />}
        <h3 className="font-black text-[#4A4A4A] text-sm md:text-base">{title}</h3>
      </div>
      <div className="text-[#4A4A4A]/75 text-sm md:text-base leading-relaxed space-y-2 pr-5 border-r-2" style={{ borderColor: `${color}40` }}>
        {children}
      </div>
    </div>
  );
}

// ─── مكوّن بند قائمة ─────────────────────────────────────────────────────────
function ListItem({ children, accent = 'pink' }) {
  const color = accent === 'gold' ? '#C5A059' : '#D9A3AA';
  return (
    <li className="flex items-start gap-2 text-sm md:text-base leading-relaxed text-[#4A4A4A]/80">
      <CheckCircle size={15} style={{ color }} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

// ─── بطاقة تنبيه ─────────────────────────────────────────────────────────────
function AlertCard({ icon: Icon = AlertCircle, color = '#D9A3AA', bg = 'bg-[#D9A3AA]/8 border-[#D9A3AA]/20', children }) {
  return (
    <div className={`mt-4 flex items-start gap-3 p-4 rounded-2xl border ${bg}`}>
      <Icon size={18} style={{ color }} className="shrink-0 mt-0.5" />
      <p className="text-sm leading-relaxed text-[#4A4A4A]/80">{children}</p>
    </div>
  );
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────────────────
export default function PrivacyPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sections = [
    { id: 'data-collected',   label: 'البيانات التي نجمعها',              icon: Eye },
    { id: 'data-purpose',     label: 'الغرض من جمع البيانات',            icon: HelpCircle },
    { id: 'data-security',    label: 'أمن البيانات وتخزينها',             icon: Lock },
    { id: 'data-sharing',     label: 'مشاركة البيانات والإفصاح',          icon: Users },
    { id: 'user-rights',      label: 'حقوق صاحب البيانات',               icon: Shield },
    { id: 'user-obligations', label: 'التزامات المستخدم والمحتوى',        icon: FileText },
    { id: 'wallet-terms',     label: 'نظام المحفظة والباقات',             icon: CreditCard },
    { id: 'pricing-terms',    label: 'التسعير والدفع',                    icon: Star },
    { id: 'return-policy',    label: 'سياسة الاسترجاع والاستبدال',        icon: ShoppingBag },
    { id: 'disclaimer',       label: 'إخلاء المسؤولية',                   icon: AlertCircle },
    { id: 'general-terms',    label: 'أحكام عامة والاختصاص القضائي',      icon: Scale },
  ];

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#4A4A4A] font-sans" dir="rtl">

      {/* ═══ شريط التنقل ═══════════════════════════════════════════════════════ */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F8F5F2]/95 backdrop-blur-md shadow-sm border-b border-[#D9A3AA]/15' : 'bg-[#F8F5F2]'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logo} alt="Art Moment" className="w-8 h-8 object-contain" />
            <div>
              <p className="text-sm font-black text-[#4A4A4A] leading-none">لحظة فن</p>
              <p className="text-[9px] text-[#C5A059] font-bold tracking-widest uppercase">Art Moment</p>
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-[#4A4A4A]/60 hover:text-[#D9A3AA] transition-colors bg-white border border-[#D9A3AA]/20 px-4 py-2 rounded-full shadow-sm"
          >
            <ArrowRight size={14} />
            الرجوع للرئيسية
          </Link>
        </div>
      </header>

      {/* ═══ هيدر الصفحة ══════════════════════════════════════════════════════ */}
      <div className="bg-[#4A4A4A] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D9A3AA]/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#C5A059]/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-20 relative z-10">
          {/* شارة */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D9A3AA]/20 border border-[#D9A3AA]/30 text-[#D9A3AA] text-xs font-bold mb-6">
            <Shield size={14} />
            وثيقة قانونية مُحدَّثة — 2026
          </div>

          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
            سياسة الخصوصية
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#D9A3AA] to-[#C5A059]">وشروط الاستخدام</span>
          </h1>

          <p className="text-white/65 text-base md:text-lg leading-relaxed max-w-2xl mb-8">
            تم إعداد هذه الوثيقة لتتوافق تماماً مع <strong className="text-white/90">نظام حماية البيانات الشخصية</strong> الصادر بالمرسوم الملكي رقم (م/19) وتعديلاته، ونظام التجارة الإلكترونية في المملكة العربية السعودية.
            يمثل استخدامك لخدمات منصة "لحظة فن" موافقة صريحة على كافة الشروط والسياسات الواردة أدناه.
          </p>

          {/* شريط فاصل بمعلومات مختصرة */}
          <div className="flex flex-wrap gap-4 text-xs font-bold text-white/50">
            <span className="flex items-center gap-1.5"><CheckCircle size={13} className="text-[#C5A059]" /> يسري اعتباراً من: مايو 2026</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={13} className="text-[#C5A059]" /> الاختصاص: المحاكم السعودية — الأحساء</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={13} className="text-[#D9A3AA]" /> كادر نسائي كامل 100%</span>
          </div>
        </div>
      </div>

      {/* ═══ جدول المحتويات ════════════════════════════════════════════════════ */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-[#D9A3AA]/15 shadow-sm overflow-x-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 py-3 whitespace-nowrap">
            <span className="text-xs font-bold text-[#4A4A4A]/40 ml-3 shrink-0">الأقسام:</span>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#4A4A4A]/60 hover:text-[#D9A3AA] hover:bg-[#D9A3AA]/8 transition-colors shrink-0"
              >
                <s.icon size={12} />
                {i + 1}. {s.label.split(' ').slice(0, 2).join(' ')}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ المحتوى الرئيسي ═══════════════════════════════════════════════════ */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-6">

        {/* ══ رأس: سياسة الخصوصية ══════════════════════════════════════════ */}
        <div className="flex items-center gap-3 pt-2 pb-1">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#D9A3AA] to-[#C5A059]"></div>
          <h2 className="text-xl md:text-2xl font-black text-[#4A4A4A]">أولاً: سياسة الخصوصية</h2>
        </div>

        {/* 1. البيانات التي نجمعها */}
        <Section id="data-collected" icon={Eye} title="البيانات التي نجمعها" number="1" accent="pink">
          <p className="mt-4 text-sm md:text-base text-[#4A4A4A]/70 leading-relaxed">
            نقوم بجمع البيانات الشخصية بالقدر اللازم لتقديم خدمات الطباعة وتوصيلها، وتشمل:
          </p>
          <ul className="mt-4 space-y-2.5">
            <ListItem><strong className="text-[#4A4A4A]">البيانات الأساسية:</strong> الاسم الثلاثي، رقم الجوال، وعنوان التوصيل (المدينة، الحي، الشارع).</ListItem>
            <ListItem><strong className="text-[#4A4A4A]">المواد البصرية (الصور):</strong> الصور الفوتوغرافية والملفات التي يتم رفعها أو إرسالها لغرض فحص الجودة والطباعة (مثل مقاسات 4×6 أو A4 وتجهيز الألبومات).</ListItem>
            <ListItem><strong className="text-[#4A4A4A]">البيانات المالية والتشغيلية:</strong> سجل مدفوعاتك، رصيد المحفظة (الباقات مسبقة الدفع والكاش باك)، وتاريخ الطلبات.</ListItem>
          </ul>
        </Section>

        {/* 2. الغرض من جمع البيانات */}
        <Section id="data-purpose" icon={HelpCircle} title="الغرض من جمع البيانات (المسوّغ النظامي)" number="2" accent="pink">
          <p className="mt-4 text-sm md:text-base text-[#4A4A4A]/70 leading-relaxed">
            تُجمع البيانات وفقاً للمسوّغ النظامي <em>(التعاقد لتقديم الخدمة)</em>، وتُستخدم في:
          </p>
          <ul className="mt-4 space-y-2.5">
            <ListItem>معالجة الطلبات، تنفيذ عمليات الطباعة، وتجهيز الألبومات.</ListItem>
            <ListItem>إدارة رصيد "المحفظة" والباقات وعمليات الخصم وإضافة نقاط الولاء.</ListItem>
            <ListItem>التواصل المباشر لإرسال الفواتير وتحديثات حالة الطلب (عبر تطبيق واتساب).</ListItem>
            <ListItem>توصيل المنتجات إلى العنوان المحدد.</ListItem>
          </ul>
        </Section>

        {/* 3. أمن البيانات وتخزينها */}
        <Section id="data-security" icon={Lock} title="أمن البيانات وتخزينها (الاحتفاظ والإتلاف)" number="3" accent="pink">

          <AlertCard color="#D9A3AA" bg="bg-[#D9A3AA]/8 border-[#D9A3AA]/25" icon={Shield}>
            <strong>سرية الصور — كادر نسائي 100%:</strong> لزيادة مستوى الطمأنينة والراحة التامة لعملائنا، نؤكد أن استقبال، ومعالجة، وطباعة، وتغليف كافة الصور والمواد البصرية يتم حصرياً بأيدي <strong>كادر نسائي كامل 100%</strong>. تُعامل جميع الصور المرفوعة بسرية مطلقة، ولا يُسمح بالاطلاع عليها أو التعامل معها إلا من قِبل الموظفات المختصات بتنفيذ الطباعة فقط.
          </AlertCard>

          <SubSection icon={Trash2} title="إتلاف البيانات (الصور)" accent="pink">
            <p>التزاماً بمبدأ الحد الأدنى للاحتفاظ بالبيانات، يتم <strong>إتلاف/حذف الصور الفوتوغرافية</strong> من خوادم وأجهزة "لحظة فن" بشكل نهائي ومحكم بعد تسليم الطلب للعميل والتأكد من عدم وجود أي ملاحظات عليه، ما لم يطلب العميل صراحةً الاحتفاظ بها لغرض الطباعة المتكررة مستقبلاً.</p>
          </SubSection>

          <SubSection icon={Lock} title="حفظ البيانات الأساسية" accent="pink">
            <p>تُحفظ البيانات الأساسية (الاسم، الجوال، سجل الطلبات والمحفظة) في خوادم آمنة لتسهيل تقديم الخدمة مستقبلاً، مع تطبيق أعلى معايير التشفير التقنية لمنع الوصول غير المصرح به أو التسريب.</p>
          </SubSection>
        </Section>

        {/* 4. مشاركة البيانات والإفصاح */}
        <Section id="data-sharing" icon={Users} title="مشاركة البيانات والإفصاح" number="4" accent="pink">
          <ul className="mt-4 space-y-2.5">
            <ListItem>لا يتم بيع، أو تأجير، أو مشاركة بياناتك الشخصية أو صورك لأي طرف ثالث لغرض التسويق.</ListItem>
            <ListItem>يقتصر الإفصاح عن البيانات الأساسية (الاسم، الجوال، العنوان) فقط لشركات الشحن والتوصيل المتعاقد معها لتنفيذ تسليم الطلب، ويقتصر التسليم على الطرود المغلفة والجاهزة دون أي إطلاع على المحتوى الداخلي.</ListItem>
            <ListItem>قد يُفصح عن البيانات الأساسية فقط في حال وجود مسوّغ نظامي أو طلب رسمي من الجهات القضائية أو الأمنية في المملكة العربية السعودية.</ListItem>
          </ul>
        </Section>

        {/* 5. حقوق صاحب البيانات */}
        <Section id="user-rights" icon={Shield} title="حقوق صاحب البيانات (المستخدم)" number="5" accent="pink">
          <p className="mt-4 text-sm md:text-base text-[#4A4A4A]/70 leading-relaxed">
            وفقاً لنظام حماية البيانات الشخصية السعودي، يتمتع العميل بالحقوق التالية:
          </p>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            {[
              { icon: Eye,    title: 'الحق في العلم',     desc: 'معرفة ماهية البيانات التي تُجمع وكيفية استخدامها.' },
              { icon: FileText, title: 'الحق في الوصول', desc: 'طلب الحصول على نسخة من بياناته الشخصية المحفوظة.' },
              { icon: Edit3,  title: 'الحق في التصحيح',  desc: 'طلب تصحيح أي بيانات شخصية غير دقيقة أو تحديثها.' },
              { icon: Trash2, title: 'الحق في الإتلاف',  desc: 'طلب مسح البيانات الشخصية متى انتهى الغرض منها، ما لم تكن ثمة التزامات مالية قائمة.' },
            ].map(right => (
              <div key={right.title} className="flex items-start gap-3 p-4 bg-[#F8F5F2] rounded-2xl border border-[#D9A3AA]/15">
                <div className="w-9 h-9 rounded-xl bg-[#D9A3AA]/15 flex items-center justify-center shrink-0">
                  <right.icon size={16} className="text-[#C48A92]" />
                </div>
                <div>
                  <p className="font-bold text-[#4A4A4A] text-sm">{right.title}</p>
                  <p className="text-xs text-[#4A4A4A]/60 leading-relaxed mt-0.5">{right.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── فاصل: شروط الاستخدام ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-4 pb-1">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#C5A059] to-[#D9A3AA]"></div>
          <h2 className="text-xl md:text-2xl font-black text-[#4A4A4A]">ثانياً: شروط وأحكام الاستخدام</h2>
        </div>

        {/* 6. التزامات المستخدم والمحتوى */}
        <Section id="user-obligations" icon={FileText} title="التزامات المستخدم والمحتوى" number="6" accent="gold">
          <ul className="mt-4 space-y-2.5">
            <ListItem accent="gold">يتعهد العميل بأنه يمتلك الحقوق القانونية والفكرية أو الصلاحية لطباعة الصور التي يقوم بإرسالها.</ListItem>
            <ListItem accent="gold">يُمنع منعاً باتاً إرسال أو طلب طباعة أي صور أو محتوى يخالف الشريعة الإسلامية، أو الآداب العامة، أو الأنظمة وقوانين المملكة العربية السعودية.</ListItem>
            <ListItem accent="gold">تحتفظ "لحظة فن" بالحق الكامل في رفض أي طلب طباعة يتضمن محتوى مخالفاً أو مشتبهاً به، دون تحمل أي مسؤولية قانونية تجاه العميل.</ListItem>
          </ul>
        </Section>

        {/* 7. نظام المحفظة والباقات */}
        <Section id="wallet-terms" icon={CreditCard} title="نظام المحفظة والباقات (الرصيد المدفوع مقدماً والكاش باك)" number="7" accent="gold">
          <ul className="mt-4 space-y-2.5">
            <ListItem accent="gold">الرصيد المضاف إلى المحفظة — سواء من الشحن المسبق للباقات (البرونزية / الفضية / الذهبية)، أو من رصيد الولاء/الكاش باك — مخصص للاستخدام حصرياً داخل منصة "لحظة فن".</ListItem>
            <ListItem accent="gold">رصيد الباقات والمكافآت الإضافية الممنوحة <strong className="text-[#4A4A4A]">غير قابل للاسترداد النقدي (Cash Refund)</strong> أو التحويل لحسابات بنكية، ويُستخدم فقط لخصم قيمة المشتريات والخدمات من الموقع.</ListItem>
            <ListItem accent="gold">يلتزم الموقع بالاحتفاظ برصيد العميل <strong className="text-[#4A4A4A]">دون تاريخ انتهاء صلاحية</strong>، ويحق للعميل تجزئة استخدام الرصيد على عدة طلبات.</ListItem>
          </ul>
        </Section>

        {/* 8. التسعير والدفع */}
        <Section id="pricing-terms" icon={Star} title="التسعير والدفع" number="8" accent="gold">
          <ul className="mt-4 space-y-2.5">
            <ListItem accent="gold">يتم تحديد الأسعار بناءً على المقاسات (مثل 4×6 أو A4) وأنواع الألبومات المطلوبة.</ListItem>
            <ListItem accent="gold">يطبق النظام تسعيراً ديناميكياً يخفض تكلفة الصورة الواحدة كلما زادت الكمية. يُعتبر السعر المعروض في الفاتورة النهائية وقت اعتماد الطلب هو السعر الملزم.</ListItem>
            <ListItem accent="gold">في حال وجود مديونيات أو مبالغ متبقية على العميل من طلبات سابقة، يحق لـ "لحظة فن" تعليق الطلبات الجديدة أو خصم المستحقات من رصيد المحفظة المتاح.</ListItem>
          </ul>
        </Section>

        {/* 9. سياسة الاسترجاع */}
        <Section id="return-policy" icon={ShoppingBag} title="سياسة الاسترجاع والاستبدال" number="9" accent="gold">
          <AlertCard color="#C5A059" bg="bg-[#C5A059]/8 border-[#C5A059]/25" icon={Scale}>
            استناداً إلى <strong>المادة الثالثة عشرة من نظام التجارة الإلكترونية</strong> المتعلقة بحالات عدم جواز فسخ العقد، ونظراً لطبيعة الخدمة التي تعتمد على تصنيع منتج بناءً على طلب المستهلك ومواصفات حددها:
          </AlertCard>
          <ul className="mt-4 space-y-2.5">
            <ListItem accent="gold">لا يحق للعميل استرجاع أو إلغاء الطلب بعد البدء في عملية الطباعة الفعليّة (حالة الطلب: <strong className="text-[#4A4A4A]">قيد الطباعة</strong>).</ListItem>
            <ListItem accent="gold">يحق للعميل طلب استبدال أو إعادة طباعة المنتجات <strong className="text-[#4A4A4A]">فقط</strong> في حال وجود عيب مصنعي واضح (مثل تلف الورق، أو أخطاء فادحة في جودة الطباعة من طرف المنصة).</ListItem>
            <ListItem accent="gold">يجب الإبلاغ عن العيب خلال مدة أقصاها <strong className="text-[#4A4A4A]">(3) أيام</strong> من تاريخ الاستلام.</ListItem>
          </ul>
        </Section>

        {/* 10. إخلاء المسؤولية */}
        <Section id="disclaimer" icon={AlertCircle} title="إخلاء المسؤولية" number="10" accent="gold">
          <div className="mt-4 space-y-3 text-sm md:text-base text-[#4A4A4A]/80 leading-relaxed">
            <p>نحرص في (لحظة فن) على استخدام أحدث تقنيات الطباعة وأجود أنواع الورق لضمان أفضل نتيجة لصوركم. ومع ذلك، نود التنويه إلى أنه من الطبيعي جداً وجود اختلاف طفيف في درجات الألوان بين ما تراه على شاشة جوالك، وبين الصورة المطبوعة على الورق.</p>
            <p className="font-bold text-[#4A4A4A]">السبب العلمي والتقني لهذا الاختلاف:</p>
            <p>📱 <strong className="text-[#4A4A4A]">شاشات الأجهزة (نظام RGB):</strong> تعتمد شاشات الجوالات والكمبيوترات على (الضوء المنبعث) وتستخدم نظام الألوان (الأحمر، الأخضر، الأزرق - RGB)، مما يجعل الألوان تبدو مضيئة ومشرقة جداً.</p>
            <p>🖨️ <strong className="text-[#4A4A4A]">الطباعة على الورق (نظام CMYK):</strong> تعتمد الطابعات على الحبر (الضوء المنعكس) وتستخدم نظام (السماوي، الأرجواني، الأصفر، الأسود - CMYK). ونظراً لطبيعة الورق وامتصاصه للحبر، قد تبدو الألوان أهدأ قليلاً أو أغمق بنسبة بسيطة مقارنة بتوهج الشاشة.</p>
            <p>لذلك، هذا الاختلاف التقني هو معيار طبيعي وعالمي في مجال الطباعة، ولا يُعد عيباً مصنعياً أو خطأً في جودة الطباعة من طرف المنصة.</p>
            <p>المنصة غير مسؤولة نهائياً عن ضعف جودة الطباعة أو البكسلة (Pixilation) إذا كانت الصور المرسلة من قِبل العميل ذات دقة أو جودة منخفضة أساساً.</p>
          </div>
        </Section>

        {/* ── فاصل: أحكام عامة ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-4 pb-1">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#4A4A4A] to-[#C5A059]"></div>
          <h2 className="text-xl md:text-2xl font-black text-[#4A4A4A]">ثالثاً: أحكام عامة والاختصاص القضائي</h2>
        </div>

        {/* 11. أحكام عامة */}
        <Section id="general-terms" icon={Scale} title="أحكام عامة والاختصاص القضائي" number="11" accent="pink">
          <div className="mt-4 space-y-4">

            <div className="p-4 bg-[#F8F5F2] rounded-2xl border border-[#4A4A4A]/8">
              <h4 className="font-bold text-[#4A4A4A] text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={14} className="text-[#D9A3AA]" /> تحديث السياسات
              </h4>
              <p className="text-sm text-[#4A4A4A]/70 leading-relaxed">يحق لـ "لحظة فن" تحديث سياسة الخصوصية وشروط الاستخدام هذه عند الحاجة، ويُعتبر استمرار استخدام العميل للخدمات بعد التحديث موافقة عليها.</p>
            </div>

            <div className="p-4 bg-[#F8F5F2] rounded-2xl border border-[#4A4A4A]/8">
              <h4 className="font-bold text-[#4A4A4A] text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={14} className="text-[#D9A3AA]" /> القانون المطبق
              </h4>
              <p className="text-sm text-[#4A4A4A]/70 leading-relaxed">تخضع هذه الشروط والسياسات وتُفسَّر وفقاً للأنظمة المعمول بها في المملكة العربية السعودية.</p>
            </div>

            <div className="p-4 bg-[#F8F5F2] rounded-2xl border border-[#4A4A4A]/8">
              <h4 className="font-bold text-[#4A4A4A] text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={14} className="text-[#D9A3AA]" /> الاختصاص القضائي
              </h4>
              <p className="text-sm text-[#4A4A4A]/70 leading-relaxed">في حال نشوء أي نزاع يتعلق بهذه الشروط أو باستخدام خدماتنا، يتم حله ودياً أولاً، وإذا تعذر ذلك يكون الاختصاص الحصري <strong className="text-[#4A4A4A]">للمحاكم المختصة في المنطقة الشرقية (الأحساء)</strong>، المملكة العربية السعودية.</p>
            </div>

          </div>
        </Section>

        {/* ═══ بطاقة التواصل ════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-[#4A4A4A] to-[#3a3a3a] text-white rounded-3xl p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#D9A3AA]/10 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-[#C5A059]/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#D9A3AA]/20 flex items-center justify-center">
                <Phone size={20} className="text-[#D9A3AA]" />
              </div>
              <h3 className="text-xl font-black">معلومات التواصل المباشر</h3>
            </div>
            <p className="text-white/55 text-sm mb-8">لأي استفسار أو لتقديم طلب يتعلق بحقوق حماية بياناتك الشخصية، أو تقديم شكوى، يُرجى التواصل معنا:</p>

            <div className="grid sm:grid-cols-3 gap-4">
              <a
                href="mailto:art.moment26@gmail.com"
                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors group"
              >
                <Mail size={20} className="text-[#D9A3AA] shrink-0" />
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">البريد الإلكتروني</p>
                  <p className="text-sm font-bold group-hover:text-[#D9A3AA] transition-colors">art.moment26@gmail.com</p>
                </div>
              </a>

              <a
                href="https://wa.me/966569663697"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors group"
              >
                <Phone size={20} className="text-[#C5A059] shrink-0" />
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">واتساب</p>
                  <p className="text-sm font-bold group-hover:text-[#C5A059] transition-colors">0569663697</p>
                </div>
              </a>

              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                <MapPin size={20} className="text-[#D9A3AA] shrink-0" />
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">الموقع</p>
                  <p className="text-sm font-bold">المملكة العربية السعودية، الأحساء</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* ═══ تذييل الصفحة ══════════════════════════════════════════════════════ */}
      <footer className="bg-[#4A4A4A] text-white py-10 text-center mt-10">
        <div className="max-w-5xl mx-auto px-4">
          <img src={logo} alt="Art Moment" className="h-10 w-auto mx-auto mb-4 brightness-0 invert opacity-70" />
          <p className="text-xs text-white/40 mb-4">
            © 2026 Art Moment — لحظة فن. جميع الحقوق محفوظة.
          </p>
          <Link to="/" className="text-xs text-[#D9A3AA] hover:text-[#C5A059] transition-colors font-bold">
            ← العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </footer>

    </div>
  );
}

// src/LandingPage.jsx
import { Link } from 'react-router-dom'
import logoImg from './assets/logo.png'
import heroImage from './assets/HERO_IMAGE_URL.jpg'

// لو حصلت مشكلة في تحميل الصورة المحلية، نستخدم رابط احتياطي من الإنترنت
const FALLBACK_HERO_IMAGE_URL =
  'https://images.pexels.com/photos/1398325/pexels-photo-1398325.jpeg?auto=compress&cs=tinysrgb&w=1200'

export default function LandingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* الهيدر */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* الشعار */}
          <div className="flex items-center gap-2">
            <img
              src={logoImg}
              alt="Art Moment Logo"
              className="w-9 h-9 rounded-xl bg-slate-900/90 p-1 object-contain"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">
                Art Moment | لحظة فن
              </div>
              <div className="text-[11px] text-emerald-600">
                Printing &amp; Painting
              </div>
            </div>
          </div>

          {/* روابط الهيدر */}
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <a href="#services" className="text-slate-700 hover:text-slate-900">
              خدمات الطباعة
            </a>
            <a href="#sizes" className="text-slate-700 hover:text-slate-900">
              المقاسات والأسعار التقريبية
            </a>
            <a href="#how-it-works" className="text-slate-700 hover:text-slate-900">
              كيف تتم الخدمة؟
            </a>
            <a href="#faq" className="text-slate-700 hover:text-slate-900">
              الأسئلة الشائعة
            </a>
          </nav>

          {/* أزرار سريعة */}
          <div className="flex items-center gap-2">
            <Link
              to="/track"
              className="hidden sm:inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium border border-slate-300 hover:bg-slate-50"
            >
              تتبّع طلبك
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex items-center px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
            >
              دخول لوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      {/* المحتوى الأساسي */}
      <main className="flex-1">
        {/* هيرو */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
            {/* نص الهيرو */}
            <div className="space-y-4">
              <p className="text-xs md:text-sm text-emerald-300 font-medium">
                طباعة صور فوتوغرافية في الأحساء
              </p>
              <h1 className="text-2xl md:text-4xl font-bold leading-snug">
                اطبع أجمل لحظاتك مع
                <span className="block text-emerald-300 mt-1">
                  لحظة فن | Art-Moment
                </span>
              </h1>
              <p className="text-sm md:text-base text-slate-100 leading-relaxed">
                طباعة صور مقاس 4×6 و A4 بجودة عالية، ألوان زاهية، وتفاصيل واضحة.
                أرسل صورك عبر واتساب، تابع حالة الطلب أونلاين، واستلمها جاهزة
                من المتجر أو بالتنسيق على وقت يناسبك.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://wa.me/966569663697?text=مرحباً، أود حجز طلب طباعة صور من لحظة فن."
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  إرسال الصور عبر واتساب
                </a>
                <Link
                  to="/track"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs md:text-sm font-medium border border-slate-400/70 text-slate-50 hover:bg-slate-800/70"
                >
                  تتبّع طلب سابق
                </Link>
              </div>

              <div className="text-[11px] md:text-xs text-slate-300 space-y-1 pt-2">
                <p>• تجهيز سريع للطلبات اليومية والمناسبات الخاصة.</p>
                <p>• مراجعة سريعة لجودة الصور قبل الطباعة قدر الإمكان.</p>
                <p>• إمكانية التواصل معك عند وجود ملاحظات على الصور أو المقاسات.</p>
              </div>
            </div>

            {/* صورة الهيرو */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-20 h-20 rounded-3xl bg-emerald-400/20 blur-2xl" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-3xl bg-sky-400/20 blur-2xl" />
              <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900">
                <img
                  src={heroImage || FALLBACK_HERO_IMAGE_URL}
                  alt="طباعة صور فوتوغرافية"
                  className="w-full h-64 md:h-72 object-cover"
                />
                <div className="p-3 md:p-4 text-xs md:text-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold">صور فوتوغرافية مطبوعة</span>
                    <span className="text-[11px] text-emerald-300">
                      4×6 &amp; A4
                    </span>
                  </div>
                  <p className="text-[11px] md:text-xs text-slate-200 leading-relaxed">
                    نهتم بتوازن الألوان والحدة في كل صورة، لتخرج مطبوعاتك بأفضل شكل ممكن،
                    وتكون جاهزة للألبوم، الإطار، أو الإهداء.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* المقاسات الرئيسية */}
        <section id="sizes" className="py-10 md:py-14">
          <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                مقاسات الطباعة المتوفرة
              </h2>
              <p className="text-sm text-slate-600">
                اختر المقاس المناسب لاستخدامك، وسنحرص على أن تكون النتيجة بجودة
                تليق بذكرياتك.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {/* 4×6 */}
              <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-2">
                <h3 className="text-base md:text-lg font-semibold text-slate-900">
                  طباعة صور مقاس 4×6
                </h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  صور فوتوغرافية كلاسيكية تناسب الألبومات والإطارات الصغيرة. نستخدم
                  ورق طباعة مخصص للصور مع ألوان زاهية وتفاصيل واضحة، لتبقى كل صورة
                  محتفظة بجمال اللحظة.
                </p>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  مثالية لصور العائلة، الرحلات، والمناسبات اليومية. يمكنك إرسال مجموعة
                  كبيرة من الصور دفعة واحدة، ونجهزها لك بترتيب منظم وجاهز للاستلام.
                </p>
                <p className="text-[11px] text-slate-500">
                  * السعر يحدد حسب عدد الصور، ويُوضَّح لك قبل تأكيد تنفيذ الطلب.
                </p>
              </article>

              {/* A4 */}
              <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-2">
                <h3 className="text-base md:text-lg font-semibold text-slate-900">
                  طباعة صور مقاس A4
                </h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  مقاس أكبر يعرض التفاصيل بوضوح أعلى، مناسب للتعليق على الجدار، أو
                  وضعه في براويز كبيرة، أو تقديمه كهدية مميزة.
                </p>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  نهتم بقصّ الصورة وضبطها قبل الطباعة قدر الإمكان حتى تظهر متوازنة،
                  مع ألوان غنية ودرجات تباين مريحة للعين.
                </p>
                <p className="text-[11px] text-slate-500">
                  * يمكن استخدام صور عالية الدقة فقط للحصول على أفضل نتيجة في هذا المقاس.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* الخدمات العامة + التتبع */}
        <section id="services" className="py-8 md:py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-[3fr,2fr] gap-6 items-start">
            {/* خدمة إدارة الطلبات / للعميل */}
            <div className="space-y-3">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                خدمة طباعة منظمة من أول رسالة حتى الاستلام
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                هدفنا أن تكون تجربتك مع الطباعة بسيطة وواضحة: ترسل الصور، نجهز لك
                الطلب، وتستلم بدون تعقيد. نستخدم نظام داخلي لإدارة الطلبات يساعدنا
                على متابعة كل خطوة، من استلام الصور إلى التسليم.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                كعميل، كل ما تحتاجه هو:
              </p>
              <ul className="text-sm text-slate-700 space-y-1 list-disc pr-5">
                <li>إرسال الصور والمقاس المطلوب عبر واتساب.</li>
                <li>استلام تأكيد الطلب والوقت التقريبي للتجهيز.</li>
                <li>تتبّع حالة طلبك أونلاين، والاستلام في الوقت المتفق عليه.</li>
              </ul>
            </div>

            {/* كرت تتبع الطلب */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5 space-y-3">
              <h3 className="text-base md:text-lg font-semibold">
                تتبّع طلبك في أي وقت
              </h3>
              <p className="text-xs md:text-sm text-slate-100 leading-relaxed">
                عند تسجيل طلبك نحفظ رقم الطلب ورقم جوالك. تقدر تدخل صفحة{' '}
                <span className="font-semibold">تتبّع الطلب</span> وتعرف آخر حالة:
                قيد المراجعة، قيد الطباعة، جاهز للاستلام، أو تم التسليم.
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                تحديث الحالة يتم في الغالب عند:
                <br />• استلام الصور وتأكيد الطلب
                <br />• بدء طباعة الصور
                <br />• جاهزية الطلب للاستلام
                <br />• إتمام التسليم
              </p>
              <Link
                to="/track"
                className="inline-flex mt-1 items-center justify-center px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                الانتقال إلى صفحة تتبّع الطلب
              </Link>
            </div>
          </div>
        </section>

        {/* كيف تتم الخدمة؟ */}
        <section id="how-it-works" className="py-10 md:py-12">
          <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                كيف تتم عملية الطباعة؟
              </h2>
              <p className="text-sm text-slate-600">
                خطوات بسيطة وواضحة من أول رسالة إلى استلام الصور جاهزة.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4 text-xs md:text-sm">
              <StepCard
                number="1"
                title="إرسال الصور"
                body="ترسل الصور عبر واتساب مع تحديد المقاس المطلوب وعدد النسخ لكل صورة إن أمكن."
              />
              <StepCard
                number="2"
                title="تأكيد الطلب"
                body="نراجع الصور سريعاً، نوضح لك أي ملاحظات ونؤكد الوقت التقريبي للتجهيز مع إجمالي التكلفة."
              />
              <StepCard
                number="3"
                title="الطباعة والتجهيز"
                body="نطبع الصور باستخدام ورق مخصص للصور مع ضبط الألوان والقص قدر الإمكان، ثم نرتبها بشكل منظم."
              />
              <StepCard
                number="4"
                title="الاستلام والتقييم"
                body="تستلم الطلب في الموعد المتفق عليه، وتقدر تشاركنا رأيك لتحسين الخدمة باستمرار."
              />
            </div>
          </div>
        </section>

        {/* الأسئلة الشائعة */}
        <section id="faq" className="py-10 md:py-12 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                أسئلة شائعة
              </h2>
              <p className="text-sm text-slate-600">
                بعض النقاط التي تُسأل كثيراً من عملاء لحظة فن.
              </p>
            </div>

            <div className="space-y-3">
              <FAQItem
                question="كم يستغرق تجهيز طلب الطباعة؟"
                answer="يعتمد الوقت على عدد الصور والضغط في اليوم نفسه، لكن في العادة يتم تجهيز الطلبات البسيطة في نفس اليوم أو اليوم التالي، وسيتم توضيح الموعد التقريبي لك عند تأكيد الطلب."
              />
              <FAQItem
                question="كيف أعرف أين وصل طلبي؟"
                answer="من خلال صفحة تتبّع الطلب في الموقع. تحتاج فقط إلى رقم الطلب ورقم الجوال الذي استخدمته في الطلب، وستظهر لك أحدث حالة مسجّلة لدينا."
              />
              <FAQItem
                question="ما هي طرق الدفع المتاحة؟"
                answer="الدفع يكون غالباً عند الاستلام نقداً أو عبر تحويل بنكي، وبعض الطلبات يمكن دفع عربون لها مسبقاً حسب الاتفاق."
              />
            </div>
          </div>
        </section>
      </main>

      {/* فوتر */}
      <footer className="border-t bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[11px] md:text-xs text-slate-500">
            © {new Date().getFullYear()} لحظة فن | Art Moment. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-3 text-[11px] md:text-xs text-slate-500">
            <span>للاستفسار السريع عبر واتساب:</span>
            <a
              href="https://wa.me/966569663697?text=مرحباً، أود الاستفسار عن خدمات طباعة الصور لديكم."
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              966569663697+
            </a>
          </div>
        </div>
      </footer>

      {/* زر واتساب ثابت */}
      <a
        href="https://wa.me/966569663697?text=مرحباً، أود حجز طلب طباعة صور من لحظة فن."
        target="_blank"
        rel="noreferrer"
        className="fixed left-4 bottom-4 z-30 inline-flex items-center gap-2 px-3 py-2 rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs md:text-sm"
      >
        <span className="text-lg">💬</span>
        <span>تواصل عبر واتساب</span>
      </a>
    </div>
  )
}

/* مكوّنات مساعدة صغيرة */

function StepCard({ number, title, body }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 h-full">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-semibold">
          {number}
        </div>
        <h3 className="text-xs md:text-sm font-semibold text-slate-900">
          {title}
        </h3>
      </div>
      <p className="text-[11px] md:text-xs text-slate-600 leading-relaxed">
        {body}
      </p>
    </div>
  )
}

function FAQItem({ question, answer }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4">
      <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-1">
        {question}
      </h3>
      <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
        {answer}
      </p>
    </div>
  )
}

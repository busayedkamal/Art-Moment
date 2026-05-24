/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      // ─── خطوط لحظة فن ──────────────────────────────
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
        ibm:  ['IBM Plex Sans Arabic', 'sans-serif'],
      },

      // ─── لوحة ألوان لحظة فن الكاملة ────────────────
      // 60% Off-white  →  خلفيات وأسطح
      // 30% Pink/Charcoal  →  نصوص وعناصر تفاعلية
      // 10% Gold  →  لمسات فاخرة واستدعاء للإجراء الحصري
      colors: {

        brand: {
          // الوردي الناعم — أزرار رئيسية، تأكيد الطلبات، التفاصيل العاطفية
          pink:    '#D9A3AA',
          'pink-light': '#EDD4D7',  // hover / backgrounds فاتح
          'pink-dark':  '#C48A92',  // pressed / active داكن

          // الذهبي المطفي — باقات VIP، شحن المحفظة، التمييز
          gold:    '#C5A059',
          'gold-light': '#DFC08A',  // hover
          'gold-dark':  '#A8893C',  // pressed

          // الرمادي الفحمي — نصوص، أيقونات، عناوين
          charcoal:    '#4A4A4A',
          'charcoal-60': 'rgba(74,74,74,0.60)', // نص ثانوي
          'charcoal-40': 'rgba(74,74,74,0.40)', // نص ثالثي / captions
          'charcoal-15': 'rgba(74,74,74,0.15)', // dividers ناعمة
          'charcoal-08': 'rgba(74,74,74,0.08)', // hover خلفية ناعمة
        },

        surface: {
          // الخلفيات والأسطح
          bg:      '#F8F5F2',   // خلفية التطبيق الأساسية (Off-white)
          card:    '#FFFFFF',   // بطاقات ونوافذ منبثقة
          divider: 'rgba(74,74,74,0.12)', // خطوط فاصلة ناعمة
          overlay: 'rgba(74,74,74,0.40)', // طبقة التعتيم للـ modals
        },

      },

      // ─── ظلال تعكس الهوية البصرية ───────────────────
      boxShadow: {
        'card':   '0 2px 12px rgba(74,74,74,0.06)',   // بطاقة عادية
        'card-md':'0 4px 20px rgba(74,74,74,0.10)',   // بطاقة مرتفعة
        'pink':   '0 4px 14px rgba(217,163,170,0.35)',// زر وردي
        'gold':   '0 4px 14px rgba(197,160,89,0.35)', // زر ذهبي
      },

      // ─── حركات ناعمة (Micro-interactions) ───────────
      transitionTimingFunction: {
        'art': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

    },
  },
  plugins: [],
}
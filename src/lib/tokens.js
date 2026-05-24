/**
 * tokens.js — لوحة ألوان لحظة فن (Design Tokens)
 *
 * مرجع موحّد يُستخدم عند الحاجة لتمرير الألوان كـ values (JS)
 * مثل: مكتبات الرسم البياني (Recharts)، inline styles، إلخ.
 *
 * للاستخدام في Tailwind CSS: استخدم الـ classes مباشرة
 * مثال:  bg-brand-pink · text-brand-charcoal · border-surface-divider
 */

export const COLORS = {
  // ── الوردي الناعم — Memory Pink ─────────────
  pink:       '#D9A3AA',
  pinkLight:  '#EDD4D7',
  pinkDark:   '#C48A92',

  // ── الذهبي المطفي — Matte Gold ───────────────
  gold:       '#C5A059',
  goldLight:  '#DFC08A',
  goldDark:   '#A8893C',

  // ── الرمادي الفحمي — Charcoal Grey ──────────
  charcoal:   '#4A4A4A',
  charcoal60: 'rgba(74,74,74,0.60)',
  charcoal40: 'rgba(74,74,74,0.40)',
  charcoal15: 'rgba(74,74,74,0.15)',
  charcoal08: 'rgba(74,74,74,0.08)',

  // ── الأسطح — Surfaces ────────────────────────
  bg:         '#F8F5F2',   // خلفية التطبيق (Off-white)
  card:       '#FFFFFF',   // بطاقات ونوافذ
  divider:    'rgba(74,74,74,0.12)',
  overlay:    'rgba(74,74,74,0.40)',
};

/**
 * ألوان مُعدّة لـ Recharts وأدوات الرسم البياني
 * الاستخدام:  stroke={CHART_COLORS.revenue}
 */
export const CHART_COLORS = {
  revenue:   COLORS.pink,
  expenses:  '#EF4444',    // أحمر قياسي للمصروفات
  profit:    '#10B981',    // أخضر قياسي للأرباح
  gold:      COLORS.gold,
  charcoal:  COLORS.charcoal,
  bg:        COLORS.bg,
};

/**
 * الظلال — Box Shadows
 */
export const SHADOWS = {
  card:    '0 2px 12px rgba(74,74,74,0.06)',
  cardMd:  '0 4px 20px rgba(74,74,74,0.10)',
  pink:    '0 4px 14px rgba(217,163,170,0.35)',
  gold:    '0 4px 14px rgba(197,160,89,0.35)',
};

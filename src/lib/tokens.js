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
  pink:       '#E8B4BC',
  pinkLight:  '#F5DEE2',
  pinkDark:   '#B96F7D',

  // ── الذهبي المطفي — Matte Gold ───────────────
  gold:       '#C6A56B',
  goldLight:  '#E5CF9F',
  goldDark:   '#8F713C',

  // ── الرمادي الفحمي — Charcoal Grey ──────────
  charcoal:   '#171717',
  charcoal60: 'rgba(23,23,23,0.60)',
  charcoal40: 'rgba(23,23,23,0.40)',
  charcoal15: 'rgba(23,23,23,0.15)',
  charcoal08: 'rgba(23,23,23,0.08)',

  // ── الأسطح — Surfaces ────────────────────────
  bg:         '#FAF9F7',   // خلفية التطبيق (Off-white)
  card:       '#FFFFFF',   // بطاقات ونوافذ
  divider:    'rgba(23,23,23,0.12)',
  overlay:    'rgba(23,23,23,0.40)',
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
  card:    '0 2px 12px rgba(23,23,23,0.05)',
  cardMd:  '0 10px 28px rgba(23,23,23,0.08)',
  pink:    '0 4px 14px rgba(232,180,188,0.24)',
  gold:    '0 4px 14px rgba(198,165,107,0.24)',
};

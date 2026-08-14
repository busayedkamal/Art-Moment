import { getServiceClient } from './supabase.ts';

type CouponRecord = {
  code: string;
  discount_type: string;
  discount_amount: number;
  is_active?: boolean;
  scope?: 'all' | 'products' | 'print';
};

export type StoreCouponResult = {
  code: string;
  discountType: string;
  discountAmount: number;
  discountValue: number;
  subtotal: number;
  totalAfterDiscount: number;
  scope: 'all' | 'products' | 'print';
  scopeLabel: string;
};

export function normalizeCouponCode(value: unknown) {
  return String(value || '').trim().toUpperCase().slice(0, 40);
}

export async function calculateStoreCouponDiscount(
  supabase: ReturnType<typeof getServiceClient>,
  codeInput: unknown,
  subtotalInput: unknown,
  scopedSubtotals?: { products?: unknown; print?: unknown },
) {
  const code = normalizeCouponCode(codeInput);
  const subtotal = Math.max(0, Number(subtotalInput || 0));

  if (!code) return null;
  if (subtotal <= 0) throw new Error('empty_cart');

  let couponResult = await supabase
    .from('coupons')
    .select('code, discount_type, discount_amount, is_active, scope')
    .ilike('code', code)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (couponResult.error && /scope|schema cache|column/i.test(couponResult.error.message || '')) {
    couponResult = await supabase
      .from('coupons')
      .select('code, discount_type, discount_amount, is_active')
      .ilike('code', code)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
  }

  const { data: coupon, error } = couponResult;
  if (error) throw error;
  if (!coupon) throw new Error('invalid_coupon');

  const typedCoupon = coupon as CouponRecord;
  const scope = ['products', 'print'].includes(String(typedCoupon.scope))
    ? typedCoupon.scope as 'products' | 'print'
    : 'all';
  const eligibleSubtotal = scope === 'products'
    ? Math.max(0, Number(scopedSubtotals?.products || 0))
    : scope === 'print'
      ? Math.max(0, Number(scopedSubtotals?.print || 0))
      : subtotal;
  if (eligibleSubtotal <= 0) throw new Error('coupon_scope_empty');
  const rawAmount = Math.max(0, Number(typedCoupon.discount_amount || 0));
  const discountValue = typedCoupon.discount_type === 'percent'
    ? eligibleSubtotal * Math.min(rawAmount, 100) / 100
    : rawAmount;
  const safeDiscount = Math.min(eligibleSubtotal, Number(discountValue.toFixed(2)));

  return {
    code: typedCoupon.code,
    discountType: typedCoupon.discount_type === 'percent' ? 'percent' : 'fixed',
    discountAmount: rawAmount,
    discountValue: safeDiscount,
    subtotal,
    totalAfterDiscount: Math.max(0, Number((subtotal - safeDiscount).toFixed(2))),
    scope,
    scopeLabel: scope === 'products' ? 'المنتجات فقط' : scope === 'print' ? 'الطباعة فقط' : 'كل الطلب',
  } satisfies StoreCouponResult;
}

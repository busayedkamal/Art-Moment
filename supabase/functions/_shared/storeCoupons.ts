import { getServiceClient } from './supabase.ts';

type CouponRecord = {
  code: string;
  discount_type: string;
  discount_amount: number;
  is_active?: boolean;
};

export type StoreCouponResult = {
  code: string;
  discountType: string;
  discountAmount: number;
  discountValue: number;
  subtotal: number;
  totalAfterDiscount: number;
};

export function normalizeCouponCode(value: unknown) {
  return String(value || '').trim().toUpperCase().slice(0, 40);
}

export async function calculateStoreCouponDiscount(
  supabase: ReturnType<typeof getServiceClient>,
  codeInput: unknown,
  subtotalInput: unknown,
) {
  const code = normalizeCouponCode(codeInput);
  const subtotal = Math.max(0, Number(subtotalInput || 0));

  if (!code) return null;
  if (subtotal <= 0) throw new Error('empty_cart');

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('code, discount_type, discount_amount, is_active')
    .ilike('code', code)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!coupon) throw new Error('invalid_coupon');

  const typedCoupon = coupon as CouponRecord;
  const rawAmount = Math.max(0, Number(typedCoupon.discount_amount || 0));
  const discountValue = typedCoupon.discount_type === 'percent'
    ? subtotal * Math.min(rawAmount, 100) / 100
    : rawAmount;
  const safeDiscount = Math.min(subtotal, Number(discountValue.toFixed(2)));

  return {
    code: typedCoupon.code,
    discountType: typedCoupon.discount_type === 'percent' ? 'percent' : 'fixed',
    discountAmount: rawAmount,
    discountValue: safeDiscount,
    subtotal,
    totalAfterDiscount: Math.max(0, Number((subtotal - safeDiscount).toFixed(2))),
  } satisfies StoreCouponResult;
}

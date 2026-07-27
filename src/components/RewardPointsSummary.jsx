import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Gift, History, Sparkles, Wallet } from 'lucide-react';

const ACTIVITY_LABELS = {
  reward_points_earn: 'نقاط مكتسبة من طلب',
  reward_signup_bonus: 'مكافأة أول طلب',
  reward_friendship_bonus: 'مكافأة كود الصداقة',
  reward_points_redeem: 'استبدال نقاط',
  redeem: 'استبدال سابق',
  reward_points_restore: 'نقاط مستعادة',
  reward_points_expire: 'نقاط منتهية',
  reward_points_adjustment: 'تعديل إداري',
  reward_points_migration: 'رصيد مرحّل',
};

function formatDate(value) {
  if (!value) return 'غير محدد';
  return new Date(value).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function RewardPointsSummary({ rewards, compact = false, embedded = false, actions = null }) {
  if (!rewards) return null;
  const lots = rewards.expiringLots || [];
  const activities = rewards.activities || [];

  return (
    <section className={embedded ? 'py-2' : 'rounded-[1.75rem] border border-[#C5A059]/20 bg-white p-5 shadow-sm'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black text-[#C5A059]"><Sparkles size={15} /> برنامج مكافآت لحظة فن</p>
          <h2 className="mt-1 text-xl font-black text-[#4A4A4A]">تفاصيل النقاط</h2>
          <p className="mt-1 text-xs text-[#4A4A4A]/55">كل ريال مدفوع مؤهل يمنح {Number(rewards.pointsPerRiyal || 2)} نقطة، والنقاط صالحة {Number(rewards.expiryMonths || 4)} أشهر.</p>
        </div>
        {actions}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#F8F5F2] p-4">
          <span className="text-[10px] font-bold text-[#4A4A4A]/50">الرصيد المتاح</span>
          <p className="mt-1 text-xl font-black text-[#D9A3AA]">{Number(rewards.points || 0).toLocaleString()} نقطة</p>
          <span className="text-[10px] text-[#4A4A4A]/45">تعادل {Number(rewards.valueSar || 0).toFixed(2)} ر.س</span>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <span className="text-[10px] font-bold text-emerald-700/60">المكتسبة إجمالاً</span>
          <p className="mt-1 text-xl font-black text-emerald-700">+{Number(rewards.earnedPointsTotal || 0).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-700/50">تشمل مكافآت الطلب والصداقة</span>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4">
          <span className="text-[10px] font-bold text-violet-700/60">المستبدلة</span>
          <p className="mt-1 text-xl font-black text-violet-700">{Number(rewards.redeemedPointsTotal || 0).toLocaleString()}</p>
          <span className="text-[10px] text-violet-700/50">استبدال يبدأ من {Number(rewards.minimumRedemptionPoints || 500).toLocaleString()}</span>
        </div>
        <div className={`rounded-2xl p-4 ${Number(rewards.expiring30DaysPoints || 0) > 0 ? 'bg-red-50' : 'bg-[#F8F5F2]'}`}>
          <span className={`text-[10px] font-bold ${Number(rewards.expiring30DaysPoints || 0) > 0 ? 'text-red-700/60' : 'text-[#4A4A4A]/50'}`}>تنتهي خلال 30 يوماً</span>
          <p className={`mt-1 text-xl font-black ${Number(rewards.expiring30DaysPoints || 0) > 0 ? 'text-red-600' : 'text-[#4A4A4A]/35'}`}>{Number(rewards.expiring30DaysPoints || 0).toLocaleString()}</p>
          <span className="text-[10px] text-[#4A4A4A]/45">المنتهية سابقاً: {Number(rewards.expiredPointsTotal || 0).toLocaleString()}</span>
        </div>
      </div>

      {Number(rewards.expiring7DaysPoints || 0) > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm font-bold">{Number(rewards.expiring7DaysPoints).toLocaleString()} نقطة ستنتهي خلال 7 أيام. استخدميها قبل فقدانها.</p>
        </div>
      )}

      {lots.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#4A4A4A]"><CalendarClock size={16} className="text-[#C5A059]" /> دفعات النقاط المتاحة</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {lots.slice(0, compact ? 2 : 6).map((lot) => (
              <div key={lot.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#D9A3AA]/10 bg-[#F8F5F2] px-3 py-2.5 text-xs">
                <div>
                  <p className="font-black text-[#4A4A4A]">{Number(lot.points || 0).toLocaleString()} نقطة</p>
                  <p className="text-[#4A4A4A]/45">بقيمة {Number(lot.valueSar || 0).toFixed(2)} ر.س</p>
                </div>
                <div className="text-left">
                  <p className={`font-black ${Number(lot.daysRemaining) <= 7 ? 'text-red-600' : 'text-[#C5A059]'}`}>{Number(lot.daysRemaining)} يوم</p>
                  <p className="text-[10px] text-[#4A4A4A]/45">{formatDate(lot.expiresAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && activities.length > 0 && (
        <div className="mt-5 border-t border-[#D9A3AA]/15 pt-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#4A4A4A]"><History size={16} className="text-[#D9A3AA]" /> أحدث حركات النقاط</h3>
          <div className="space-y-2">
            {activities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-[#4A4A4A]">{ACTIVITY_LABELS[activity.type] || 'حركة نقاط'}</p>
                  <p className="text-[10px] text-[#4A4A4A]/45">{formatDate(activity.createdAt)}</p>
                </div>
                <span className={`font-black ${Number(activity.pointsDelta) > 0 ? 'text-emerald-600' : 'text-red-500'}`} dir="ltr">
                  {Number(activity.pointsDelta) > 0 ? '+' : ''}{Number(activity.pointsDelta || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function RewardRedemptionForm({ order, rewards, onApply, submitting = false }) {
  const currentPoints = Number(order?.rewardPointsUsed ?? order?.reward_points_used ?? 0);
  const [points, setPoints] = useState(String(currentPoints || ''));
  useEffect(() => setPoints(String(currentPoints || '')), [currentPoints, order?.id]);

  const limits = useMemo(() => {
    const pointValue = Number(rewards?.pointValue || 0.01);
    const available = Number(rewards?.points || 0) + currentPoints;
    const orderValue = Number(order?.totalAmount ?? order?.total_amount ?? 0);
    const delivery = Number(order?.deliveryFee ?? order?.delivery_fee ?? 0);
    const paid = Number(order?.amountPaid ?? order?.amount_paid ?? 0);
    const currentValue = Number(order?.pointsUsedAmount ?? order?.points_used_amount ?? 0);
    const dueBeforePoints = Math.max(0, orderValue + delivery - paid - currentValue + currentPoints * pointValue);
    const byOrder = Math.floor(orderValue * Number(rewards?.maximumRedemptionPercent || 25) / 100 / pointValue);
    const byDue = Math.floor(dueBeforePoints / pointValue);
    return { pointValue, maximum: Math.max(0, Math.min(available, byOrder, byDue)) };
  }, [currentPoints, order, rewards]);

  if (!order
    || !rewards
    || ['cancelled', 'returned'].includes(order.status)
    || ['paid', 'partial_refund', 'full_refund'].includes(order.paymentStatus || order.payment_status)) return null;
  const requested = Math.max(0, Math.floor(Number(points || 0)));
  const minimum = Number(rewards.minimumRedemptionPoints || 500);
  const invalidMinimum = requested > currentPoints && requested > 0 && requested < minimum;
  const invalidMaximum = requested > limits.maximum;

  return (
    <div className="mt-4 rounded-2xl border border-[#C5A059]/25 bg-[#C5A059]/5 p-4">
      <div className="flex items-start gap-3">
        <Wallet size={18} className="mt-0.5 shrink-0 text-[#C5A059]" />
        <div className="flex-1">
          <p className="text-sm font-black text-[#4A4A4A]">استخدام نقاط المكافآت</p>
          <p className="mt-1 text-[11px] text-[#4A4A4A]/55">المتاح لهذا الطلب حتى {limits.maximum.toLocaleString()} نقطة. لا تشمل النقاط تكلفة التوصيل.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="0"
          max={limits.maximum}
          step="1"
          value={points}
          onChange={(event) => setPoints(event.target.value.replace(/\D/g, ''))}
          placeholder="0"
          className="min-w-0 flex-1 rounded-xl border border-[#D9A3AA]/20 bg-white px-3 py-2.5 text-center font-black outline-none focus:border-[#C5A059]"
        />
        <button type="button" onClick={() => setPoints(String(limits.maximum))} className="rounded-xl border border-[#C5A059]/25 bg-white px-3 text-xs font-black text-[#C5A059]">الحد الأعلى</button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[#4A4A4A]/50">القيمة: {(requested * limits.pointValue).toFixed(2)} ر.س</span>
        {currentPoints > 0 && <button type="button" onClick={() => setPoints('0')} className="font-bold text-red-500">إلغاء النقاط</button>}
      </div>
      {(invalidMinimum || invalidMaximum) && (
        <p className="mt-2 text-xs font-bold text-red-500">
          {invalidMinimum ? `الحد الأدنى للاستبدال ${minimum.toLocaleString()} نقطة.` : 'العدد أكبر من الحد المتاح لهذا الطلب.'}
        </p>
      )}
      <button
        type="button"
        onClick={() => onApply?.(requested)}
        disabled={submitting || invalidMinimum || invalidMaximum || requested === currentPoints}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A4A4A] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Gift size={16} /> {submitting ? 'جاري التحديث...' : currentPoints > 0 ? 'تحديث النقاط المستخدمة' : 'تطبيق النقاط'}
      </button>
    </div>
  );
}

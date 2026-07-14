import React from 'react';
import { Banknote, Package, ReceiptText, Tag, Wallet } from 'lucide-react';
import RiyalSign from './RiyalSign';

const THEMES = {
  light: {
    root: 'text-[#4A4A4A]',
    muted: 'text-[#4A4A4A]/55',
    row: 'border-[#D9A3AA]/15',
    discount: 'text-emerald-700 bg-emerald-50',
    payment: 'text-violet-700 bg-violet-50',
    final: 'border-[#4A4A4A]/15',
  },
  dark: {
    root: 'text-white',
    muted: 'text-white/55',
    row: 'border-white/10',
    discount: 'text-pink-200 bg-pink-500/10',
    payment: 'text-violet-200 bg-violet-500/10',
    final: 'border-white/15',
  },
  print: {
    root: 'text-[#4A4A4A]',
    muted: 'text-[#4A4A4A]/60',
    row: 'border-[#D9A3AA]/15',
    discount: 'text-emerald-700',
    payment: 'text-violet-700',
    final: 'border-[#4A4A4A]/30',
  },
};

function Money({ value, light = false }) {
  return (
    <span className="inline-flex items-center gap-1 font-bold" dir="ltr">
      {Number(value || 0).toFixed(2)} <RiyalSign light={light} />
    </span>
  );
}

export default function OrderFinancialBreakdown({
  financials,
  variant = 'light',
  showItems = true,
  showTitle = true,
  className = '',
}) {
  const theme = THEMES[variant] || THEMES.light;
  const lightMoney = variant === 'dark';
  if (!financials) return null;

  return (
    <div className={`${theme.root} ${className}`} dir="rtl">
      {showTitle && (
        <div className={`mb-3 flex items-center justify-between border-b pb-2 ${theme.row}`}>
          <span className="flex items-center gap-2 text-sm font-black">
            <ReceiptText size={16} /> تفصيل المبلغ
          </span>
          <span className={`text-[10px] font-bold ${theme.muted}`}>بالريال السعودي</span>
        </div>
      )}

      {showItems && financials.lineItems.length > 0 && (
        <div className={`mb-3 space-y-2 border-b pb-3 ${theme.row}`}>
          {financials.lineItems.map((item) => (
            <div key={item.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 font-bold">
                  <Package size={12} /> {item.label}
                </span>
                <span className={`mt-0.5 block text-[10px] ${theme.muted}`}>
                  {item.quantity} × {item.unitPrice != null ? `${item.unitPrice.toFixed(2)} ر.س` : 'السعر الفردي غير محفوظ للطلب القديم'}
                </span>
              </div>
              <span className="font-black">
                {item.lineTotal != null ? <Money value={item.lineTotal} light={lightMoney} /> : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className={theme.muted}>المجموع الفرعي</span>
          <Money value={financials.subtotal} light={lightMoney} />
        </div>
        {financials.deliveryFee > 0 && (
          <div className="flex items-center justify-between">
            <span className={theme.muted}>التوصيل أو التكاليف الإضافية</span>
            <Money value={financials.deliveryFee} light={lightMoney} />
          </div>
        )}
        {(financials.deliveryFee > 0 || financials.discounts.length > 0) && (
          <div className={`flex items-center justify-between border-t pt-2 ${theme.row}`}>
            <span className={theme.muted}>الإجمالي قبل الخصم</span>
            <Money value={financials.grossAmount} light={lightMoney} />
          </div>
        )}

        {financials.discounts.map((discount) => (
          <div key={discount.key} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${theme.discount}`}>
            <span className="flex items-center gap-1.5 font-bold">
              <Tag size={11} /> {discount.label}
            </span>
            <span className="font-black" dir="ltr">-<Money value={discount.amount} light={lightMoney} /></span>
          </div>
        ))}

        {financials.reconciliationCharge > 0 && (
          <div className="flex items-center justify-between text-amber-700">
            <span>تسوية أو إضافة سابقة</span>
            <Money value={financials.reconciliationCharge} light={lightMoney} />
          </div>
        )}

        <div className={`flex items-center justify-between border-t pt-3 text-sm font-black ${theme.final}`}>
          <span>قيمة الطلب بعد الخصومات</span>
          <Money value={financials.totalAmount} light={lightMoney} />
        </div>

        {financials.pointsUsed > 0 && (
          <div className={`flex items-center justify-between rounded-md px-2 py-1.5 ${theme.payment}`}>
            <span className="flex items-center gap-1.5 font-bold"><Wallet size={11} /> مدفوع من رصيد النقاط</span>
            <span className="font-black" dir="ltr">-<Money value={financials.pointsUsed} light={lightMoney} /></span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1.5 ${theme.muted}`}><Banknote size={11} /> المدفوع نقدًا</span>
          <Money value={financials.cashPaid} light={lightMoney} />
        </div>

        <div className={`flex items-center justify-between border-t-2 pt-3 text-base font-black ${theme.final}`}>
          <span>{financials.remainingAmount > 0 ? 'المبلغ المتبقي' : 'حالة الحساب'}</span>
          <span className={financials.remainingAmount > 0 ? 'text-red-600' : 'text-emerald-600'}>
            {financials.remainingAmount > 0 ? <Money value={financials.remainingAmount} light={lightMoney} /> : 'خالص'}
          </span>
        </div>

        {financials.overpaidAmount > 0 && (
          <div className="flex items-center justify-between text-amber-700">
            <span>رصيد زائد للعميل</span>
            <Money value={financials.overpaidAmount} light={lightMoney} />
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';

export default function StorePaymentResult() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isSuccess = location.pathname.includes('/success');
  const orderId = searchParams.get('order');

  return (
    <div className="art-page min-h-screen font-sans flex items-center justify-center p-5 text-[#4A4A4A]" dir="rtl">
      <div className="w-full max-w-lg rounded-[2rem] border border-[#D9A3AA]/15 bg-white p-7 text-center shadow-xl">
        <img src={logo} alt="Art Moment" className="mx-auto mb-5 h-16 w-16 object-contain" />
        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
          isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {isSuccess ? <CheckCircle size={38} /> : <AlertCircle size={38} />}
        </div>

        <p className="mb-2 text-xs font-black text-[#C5A059]">لحظة فن Art Moment</p>
        <h1 className="mb-3 text-2xl font-black">
          {isSuccess ? 'تم تأكيد الدفع' : 'لم تكتمل عملية الدفع'}
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-[#4A4A4A]/65">
          {isSuccess
            ? 'تم تسجيل حالة الدفع بنجاح. يمكنك متابعة حالة الطلب من صفحة طلباتي.'
            : 'يمكنك إعادة المحاولة أو التواصل معنا لمساعدتك في إتمام الدفع.'}
        </p>

        {orderId && (
          <div className="mb-6 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm font-black" dir="ltr">
            #{orderId.slice(0, 8)}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/store/orders"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A4A4A] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#D9A3AA]"
          >
            <ShoppingBag size={17} /> طلباتي
          </Link>
          <Link
            to={isSuccess ? '/store' : '/store/cart'}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D9A3AA]/20 bg-white px-5 py-3 text-sm font-black text-[#4A4A4A] transition-colors hover:bg-[#F8F5F2]"
          >
            {isSuccess ? <ArrowRight size={17} /> : <RefreshCw size={17} />}
            {isSuccess ? 'المتجر' : 'إعادة المحاولة'}
          </Link>
        </div>
      </div>
    </div>
  );
}

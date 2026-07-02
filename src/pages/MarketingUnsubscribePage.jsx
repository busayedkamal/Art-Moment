import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Home, Loader2, MailX, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo-art-moment.svg';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

export default function MarketingUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState({ status: 'error', message: 'رابط إلغاء الاشتراك غير مكتمل.' });
      return;
    }

    let active = true;
    supabase.functions.invoke('customer-marketing', {
      body: { action: 'unsubscribe', token },
    }).then(({ error }) => {
      if (!active) return;
      if (error) {
        getFunctionError(error).then((message) => {
          if (active) setState({ status: 'error', message: message || 'تعذر إلغاء الاشتراك حالياً.' });
        });
        return;
      }
      setState({ status: 'success', message: 'تم إلغاء الاشتراك في الرسائل التسويقية.' });
    }).catch(() => {
      if (active) setState({ status: 'error', message: 'تعذر إلغاء الاشتراك حالياً.' });
    });

    return () => {
      active = false;
    };
  }, [searchParams]);

  const isSuccess = state.status === 'success';
  const Icon = state.status === 'loading' ? Loader2 : isSuccess ? CheckCircle : XCircle;

  return (
    <div className="art-page min-h-screen font-sans text-[#4A4A4A]" dir="rtl">
      <header className="art-nav art-nav-scrolled sticky top-0 z-40">
        <div className="art-shell h-16 flex items-center justify-between">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm font-black text-[#4A4A4A]/60 hover:text-[#D9A3AA]">
            <ArrowRight size={18} /> المتجر
          </Link>
          <img src={logo} alt="لحظة فن" className="h-9 w-auto" />
          <Link to="/" className="h-10 w-10 rounded-full border border-[#D9A3AA]/20 bg-white flex items-center justify-center text-[#4A4A4A]/60">
            <Home size={17} />
          </Link>
        </div>
      </header>

      <main className="art-shell py-16 flex justify-center">
        <section className="w-full max-w-lg rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-8 text-center shadow-sm">
          <div className={`mx-auto mb-5 h-16 w-16 rounded-full flex items-center justify-center ${
            state.status === 'loading'
              ? 'bg-[#D9A3AA]/10 text-[#D9A3AA]'
              : isSuccess
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-500'
          }`}>
            <Icon size={28} className={state.status === 'loading' ? 'animate-spin' : ''} />
          </div>
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-black text-[#C5A059]">
            <MailX size={14} /> الرسائل التسويقية
          </div>
          <h1 className="text-2xl font-black mb-3">
            {state.status === 'loading' ? 'جاري معالجة الطلب' : isSuccess ? 'تم إلغاء الاشتراك' : 'تعذر تنفيذ الطلب'}
          </h1>
          <p className="text-sm leading-7 text-[#4A4A4A]/60 mb-6">
            {state.message || 'يرجى الانتظار قليلاً.'}
          </p>
          <Link
            to="/store/account"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#4A4A4A] px-6 py-4 text-sm font-black text-white shadow-md hover:bg-[#D9A3AA] transition-colors"
          >
            فتح حسابي
          </Link>
        </section>
      </main>
    </div>
  );
}

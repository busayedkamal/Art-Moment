import React, { useState } from 'react';
import { X, Mail, Phone, User, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function CustomerAuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading]  = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', rememberMe: false,
  });

  if (!isOpen) return null;

  const set = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Simple reversible obscuring — not cryptographic, just not plaintext
  const obscure = (str) => btoa(unescape(encodeURIComponent(str)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, rememberMe } = formData;

    if (!phone || !password) {
      toast.error('رقم الجوال وكلمة المرور مطلوبان.');
      return;
    }

    setLoading(true);
    const passwordHash = obscure(password);

    try {
      if (!isLogin) {
        // ── تسجيل حساب جديد ──────────────────────────────────────────
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .or(`phone.eq.${phone}${email ? `,email.eq.${email}` : ''}`)
          .maybeSingle();

        if (existing) {
          toast.error('رقم الجوال أو البريد الإلكتروني مسجل مسبقاً. حاول تسجيل الدخول.');
          setLoading(false);
          return;
        }

        const { data: newCustomer, error: insertErr } = await supabase
          .from('customers')
          .insert({ name: name || null, email: email || null, phone, password_hash: passwordHash })
          .select()
          .single();

        if (insertErr) throw insertErr;

        const session = { id: newCustomer.id, name: newCustomer.name, email: newCustomer.email, phone: newCustomer.phone };
        localStorage.setItem('art_moment_customer', JSON.stringify(session));
        if (rememberMe) localStorage.setItem('art_moment_customer_remember', 'true');

        toast.success(`أهلاً بك في لحظة فن ${name ? name : ''}! ✨`);
        onClose();
        window.location.href = '/store';

      } else {
        // ── تسجيل الدخول ─────────────────────────────────────────────
        const { data: customer, error: fetchErr } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', phone)
          .eq('password_hash', passwordHash)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!customer) {
          toast.error('رقم الجوال أو كلمة المرور غير صحيحة.');
          setLoading(false);
          return;
        }

        const session = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
        localStorage.setItem('art_moment_customer', JSON.stringify(session));
        if (rememberMe) localStorage.setItem('art_moment_customer_remember', 'true');

        toast.success(`مرحباً بعودتك${customer.name ? ' ' + customer.name : ''}! 👋`);
        onClose();
        window.location.href = '/store';
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" dir="rtl">
      <div className="relative w-full max-w-md bg-[#F8F5F2] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 bg-white/50 backdrop-blur rounded-full flex items-center justify-center text-[#4A4A4A] hover:bg-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="bg-[#4A4A4A] pt-10 pb-6 px-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D9A3AA]/20 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#C5A059]/20 rounded-full blur-2xl" />
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-2">
              {isLogin ? 'مرحباً بعودتك! 👋' : 'انضم لعائلة لحظة فن ✨'}
            </h2>
            <p className="text-white/70 text-sm">
              {isLogin
                ? 'سجل دخولك لمتابعة طلباتك السابقة والجديدة.'
                : 'أنشئ حسابك الآن لتجربة تسوق أسهل وأسرع.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white mx-6 -mt-4 relative z-20 rounded-xl shadow-sm p-1 border border-[#D9A3AA]/10">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-[#D9A3AA] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:bg-[#F8F5F2]'}`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-[#C5A059] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:bg-[#F8F5F2]'}`}
          >
            إنشاء حساب
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 mt-2">

          {!isLogin && (
            <div className="relative animate-in slide-in-from-top-2">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="text"
                placeholder="الاسم (اختياري)"
                value={formData.name}
                onChange={set('name')}
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-[#D9A3AA]/20 bg-white focus:border-[#D9A3AA] outline-none transition-all text-sm"
              />
            </div>
          )}

          {!isLogin && (
            <div className="relative animate-in slide-in-from-top-2">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                value={formData.email}
                onChange={set('email')}
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-[#D9A3AA]/20 bg-white focus:border-[#D9A3AA] outline-none transition-all text-sm dir-ltr text-right"
              />
            </div>
          )}

          <div className="relative">
            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
            <input
              type="tel"
              required
              placeholder="رقم الجوال (05...)"
              value={formData.phone}
              onChange={set('phone')}
              className="w-full h-12 pr-12 pl-4 rounded-xl border border-[#D9A3AA]/20 bg-white focus:border-[#D9A3AA] outline-none transition-all text-sm dir-ltr text-right"
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
            <input
              type="password"
              required
              placeholder="كلمة المرور / الرمز السري"
              value={formData.password}
              onChange={set('password')}
              className="w-full h-12 pr-12 pl-4 rounded-xl border border-[#D9A3AA]/20 bg-white focus:border-[#D9A3AA] outline-none transition-all text-sm"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, rememberMe: !prev.rememberMe }))}
              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors border ${formData.rememberMe ? 'bg-[#C5A059] border-[#C5A059] text-white' : 'bg-white border-[#D9A3AA]/30'}`}
            >
              {formData.rememberMe && <span className="text-white text-[10px] font-black leading-none">✓</span>}
            </button>
            <span
              className="text-xs font-bold text-[#4A4A4A]/70 cursor-pointer select-none"
              onClick={() => setFormData(prev => ({ ...prev, rememberMe: !prev.rememberMe }))}
            >
              حفظ بيانات الدخول
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 bg-[#4A4A4A] text-white rounded-xl font-black text-sm hover:bg-[#D9A3AA] transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : isLogin
                ? <><LogIn size={18} /> دخول</>
                : <><UserPlus size={18} /> إنشاء حساب</>
            }
          </button>

        </form>
      </div>
    </div>
  );
}

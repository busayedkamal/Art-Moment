import React, { useState } from 'react';
import { X, Mail, Phone, User, Lock, LogIn, UserPlus, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  normalizeCustomerPhone,
  saveCustomerSession,
} from '../utils/customerSession';

const errorMessages = {
  customer_exists: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً. حاولي تسجيل الدخول.',
  invalid_credentials: 'رقم الجوال أو كلمة المرور غير صحيحة.',
  invalid_phone: 'رقم الجوال غير صحيح. استخدمي صيغة 05xxxxxxxx.',
};

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

async function invokeCustomerAuth(payload) {
  const { data, error } = await supabase.functions.invoke('customer-auth', { body: payload });
  if (error) {
    throw new Error(await getFunctionError(error));
  }
  return data?.customer;
}

export default function CustomerAuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    rememberMe: false,
  });

  if (!isOpen) return null;

  const set = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleRememberMe = () => {
    setFormData((prev) => ({ ...prev, rememberMe: !prev.rememberMe }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const { name, email, phone, password, rememberMe } = formData;
    const normalizedPhone = normalizeCustomerPhone(phone);
    const normalizedEmail = email.trim() || null;

    if (!normalizedPhone || !password) {
      toast.error('رقم الجوال وكلمة المرور مطلوبان.');
      return;
    }

    setLoading(true);

    try {
      const customer = await invokeCustomerAuth({
        mode: isLogin ? 'login' : 'signup',
        name: name.trim() || null,
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      });

      if (!customer?.id) throw new Error('auth_failed');

      const session = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: normalizeCustomerPhone(customer.phone),
      };

      saveCustomerSession(session, { remember: rememberMe });
      toast.success(isLogin ? 'مرحباً بعودتك إلى لحظة فن.' : 'تم إنشاء حسابك بنجاح.');
      onClose();
      window.location.href = '/store';
    } catch (error) {
      console.error(error);
      toast.error(errorMessages[error.message] || 'حدث خطأ، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="art-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" dir="rtl">
      <div className="art-auth-card relative w-full max-w-md rounded-[1.5rem] overflow-hidden animate-in zoom-in-95 duration-300">
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-4 left-4 z-10 w-8 h-8 bg-white/60 backdrop-blur rounded-full flex items-center justify-center text-[#4A4A4A] hover:bg-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="art-auth-header pt-10 pb-6 px-6 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-2">
              {isLogin ? 'مرحباً بعودتك' : 'انضمي إلى لحظة فن'}
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              {isLogin
                ? 'سجلي دخولك لمتابعة طلباتك ومحفظتك.'
                : 'أنشئي حسابك لتجربة تسوق أسرع وأكثر خصوصية.'}
            </p>
          </div>
        </div>

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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 mt-2">
          {!isLogin && (
            <div className="relative animate-in slide-in-from-top-2">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="text"
                placeholder="الاسم (اختياري)"
                value={formData.name}
                onChange={set('name')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm"
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
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm dir-ltr text-right"
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
              className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm dir-ltr text-right"
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
            <input
              type="password"
              required
              minLength={6}
              placeholder="كلمة المرور"
              value={formData.password}
              onChange={set('password')}
              className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={toggleRememberMe}
              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors border ${formData.rememberMe ? 'bg-[#C5A059] border-[#C5A059] text-white' : 'bg-white border-[#D9A3AA]/30'}`}
            >
              {formData.rememberMe && <Check size={13} strokeWidth={3} />}
            </button>
            <button
              type="button"
              onClick={toggleRememberMe}
              className="text-xs font-bold text-[#4A4A4A]/70"
            >
              حفظ بيانات الدخول
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="art-cta w-full h-12 mt-2 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn size={18} /> دخول
              </>
            ) : (
              <>
                <UserPlus size={18} /> إنشاء حساب
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

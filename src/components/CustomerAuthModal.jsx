import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  normalizeCustomerPhone,
  saveCustomerSession,
} from '../utils/customerSession';

const errorMessages = {
  customer_exists: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً. سجلي الدخول بدلاً من إنشاء حساب جديد.',
  email_send_failed: 'تعذر إرسال كود الاسترداد الآن. تأكدي من إعدادات البريد وحاولي مرة أخرى.',
  invalid_credentials: 'بيانات الدخول غير صحيحة.',
  invalid_reset_code: 'كود الاسترداد غير صحيح أو انتهت صلاحيته.',
};

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  identifier: '',
  password: '',
  confirmPassword: '',
  resetCode: '',
  rememberMe: false,
  marketingOptIn: true,
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
  return data;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function getTitle(mode) {
  if (mode === 'signup') return 'إنشاء حساب جديد';
  if (mode === 'forgot') return 'استرداد كلمة المرور';
  if (mode === 'reset') return 'تعيين كلمة مرور جديدة';
  return 'مرحباً بعودتك';
}

function getSubtitle(mode) {
  if (mode === 'signup') return 'احفظي بياناتك وطلباتك القادمة في حساب واحد.';
  if (mode === 'forgot') return 'أدخلي رقم الجوال أو البريد المرتبط بحسابك لإرسال كود الاسترداد.';
  if (mode === 'reset') return 'أدخلي الكود المرسل إلى بريدك ثم اختاري كلمة مرور جديدة.';
  return 'ادخلي برقم الجوال أو البريد الإلكتروني لمتابعة طلباتك.';
}

export default function CustomerAuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  if (!isOpen) return null;

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const set = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggle = (field) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setFormData((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
      resetCode: '',
      identifier: nextMode === 'login' ? prev.identifier : prev.identifier || prev.phone || prev.email,
    }));
  };

  const loginCustomer = async () => {
    const identifier = formData.identifier.trim();
    if (!identifier || !formData.password) {
      toast.error('رقم الجوال أو البريد الإلكتروني وكلمة المرور مطلوبة.');
      return;
    }

    const data = await invokeCustomerAuth({
      mode: 'login',
      identifier,
      password: formData.password,
    });

    const customer = data?.customer;
    if (!customer?.id) throw new Error('invalid_credentials');

    saveCustomerSession({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: normalizeCustomerPhone(customer.phone),
      marketingOptIn: customer.marketingOptIn,
    }, { remember: formData.rememberMe });

    toast.success('مرحباً بعودتك إلى لحظة فن.');
    onClose();
    window.location.href = '/store';
  };

  const signupCustomer = async () => {
    const phone = normalizeCustomerPhone(formData.phone);
    const email = normalizeEmail(formData.email);

    if (!phone || !email || !formData.password) {
      toast.error('رقم الجوال والبريد الإلكتروني وكلمة المرور مطلوبة.');
      return;
    }

    if (!isEmail(email)) {
      toast.error('البريد الإلكتروني غير صحيح.');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    const data = await invokeCustomerAuth({
      mode: 'signup',
      name: formData.name.trim() || null,
      email,
      phone,
      password: formData.password,
      marketingOptIn: formData.marketingOptIn,
    });

    const customer = data?.customer;
    if (!customer?.id) throw new Error('invalid_credentials');

    saveCustomerSession({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: normalizeCustomerPhone(customer.phone),
      marketingOptIn: customer.marketingOptIn,
    }, { remember: formData.rememberMe });

    toast.success('تم إنشاء حسابك بنجاح.');
    onClose();
    window.location.href = '/store';
  };

  const requestPasswordReset = async () => {
    const identifier = formData.identifier.trim();
    if (!identifier) {
      toast.error('أدخلي رقم الجوال أو البريد الإلكتروني أولاً.');
      return;
    }

    await invokeCustomerAuth({
      mode: 'request_password_reset',
      identifier,
    });

    toast.success('إذا كان الحساب موجوداً، سيصل كود الاسترداد إلى البريد المسجل.');
    setMode('reset');
  };

  const resetPassword = async () => {
    const identifier = formData.identifier.trim();
    const code = formData.resetCode.trim();

    if (!identifier || !code || !formData.password) {
      toast.error('البيانات المطلوبة غير مكتملة.');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    await invokeCustomerAuth({
      mode: 'reset_password',
      identifier,
      code,
      password: formData.password,
    });

    toast.success('تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.');
    setFormData((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
      resetCode: '',
    }));
    setMode('login');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isLogin) await loginCustomer();
      else if (isSignup) await signupCustomer();
      else if (isForgot) await requestPasswordReset();
      else if (isReset) await resetPassword();
    } catch (error) {
      console.error(error);
      toast.error(errorMessages[error.message] || 'حدث خطأ، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    setLoading(true);

    try {
      await requestPasswordReset();
    } catch (error) {
      console.error(error);
      toast.error(errorMessages[error.message] || 'تعذر إرسال كود جديد، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = isLogin
    ? 'دخول'
    : isSignup
      ? 'إنشاء حساب'
      : isForgot
        ? 'إرسال كود الاسترداد'
        : 'تحديث كلمة المرور';

  const SubmitIcon = isLogin ? LogIn : isSignup ? UserPlus : isForgot ? KeyRound : ShieldCheck;

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
            <h2 className="text-2xl font-black text-white mb-2">{getTitle(mode)}</h2>
            <p className="text-white/75 text-sm leading-relaxed">{getSubtitle(mode)}</p>
          </div>
        </div>

        {(isLogin || isSignup) && (
          <div className="flex bg-white mx-6 -mt-4 relative z-20 rounded-xl shadow-sm p-1 border border-[#D9A3AA]/10">
            <button
              type="button"
              onClick={() => changeMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-[#D9A3AA] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:bg-[#F8F5F2]'}`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => changeMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isSignup ? 'bg-[#C5A059] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:bg-[#F8F5F2]'}`}
            >
              إنشاء حساب
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 mt-2">
          {isSignup && (
            <div className="relative animate-in slide-in-from-top-2">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="text"
                placeholder="الاسم"
                value={formData.name}
                onChange={set('name')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm"
              />
            </div>
          )}

          {isSignup && (
            <div className="relative animate-in slide-in-from-top-2">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="email"
                required
                placeholder="البريد الإلكتروني"
                value={formData.email}
                onChange={set('email')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm dir-ltr text-right"
              />
            </div>
          )}

          {isSignup && (
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
          )}

          {(isLogin || isForgot || isReset) && (
            <div className="relative">
              {formData.identifier.includes('@') ? (
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              ) : (
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              )}
              <input
                type="text"
                required
                placeholder="رقم الجوال أو البريد الإلكتروني"
                value={formData.identifier}
                onChange={set('identifier')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm dir-ltr text-right"
              />
            </div>
          )}

          {isReset && (
            <div className="relative">
              <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C5A059]/70" size={18} />
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                placeholder="كود الاسترداد"
                value={formData.resetCode}
                onChange={set('resetCode')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm dir-ltr text-right tracking-[0.4em]"
              />
            </div>
          )}

          {(isLogin || isSignup || isReset) && (
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="password"
                required
                minLength={6}
                placeholder={isReset ? 'كلمة المرور الجديدة' : 'كلمة المرور'}
                value={formData.password}
                onChange={set('password')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm"
              />
            </div>
          )}

          {isReset && (
            <div className="relative">
              <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/60" size={18} />
              <input
                type="password"
                required
                minLength={6}
                placeholder="تأكيد كلمة المرور الجديدة"
                value={formData.confirmPassword}
                onChange={set('confirmPassword')}
                className="art-input w-full h-12 pr-12 pl-4 rounded-xl outline-none text-sm"
              />
            </div>
          )}

          {(isLogin || isSignup) && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle('rememberMe')}
                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors border ${formData.rememberMe ? 'bg-[#C5A059] border-[#C5A059] text-white' : 'bg-white border-[#D9A3AA]/30'}`}
                >
                  {formData.rememberMe && <Check size={13} strokeWidth={3} />}
                </button>
                <button
                  type="button"
                  onClick={() => toggle('rememberMe')}
                  className="text-xs font-bold text-[#4A4A4A]/70"
                >
                  حفظ الدخول
                </button>
              </div>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => changeMode('forgot')}
                  className="text-xs font-black text-[#D9A3AA] hover:text-[#C5A059] transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </div>
          )}

          {isSignup && (
            <div className="flex items-start gap-2 rounded-2xl bg-[#F8F5F2] px-3 py-3">
              <button
                type="button"
                onClick={() => toggle('marketingOptIn')}
                className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors border ${formData.marketingOptIn ? 'bg-[#D9A3AA] border-[#D9A3AA] text-white' : 'bg-white border-[#D9A3AA]/30'}`}
              >
                {formData.marketingOptIn && <Check size={13} strokeWidth={3} />}
              </button>
              <button
                type="button"
                onClick={() => toggle('marketingOptIn')}
                className="text-right text-xs leading-relaxed font-bold text-[#4A4A4A]/70"
              >
                أرغب باستقبال العروض والتحديثات على بريدي الإلكتروني.
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="art-cta w-full h-12 mt-2 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <SubmitIcon size={18} /> {submitLabel}
              </>
            )}
          </button>

          {(isForgot || isReset) && (
            <button
              type="button"
              onClick={() => changeMode('login')}
              className="w-full h-10 rounded-xl text-xs font-black text-[#4A4A4A]/60 hover:text-[#4A4A4A] flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowRight size={16} /> العودة لتسجيل الدخول
            </button>
          )}

          {isReset && (
            <button
              type="button"
              disabled={loading}
              onClick={handleResendResetCode}
              className="w-full text-xs font-bold text-[#D9A3AA] hover:text-[#C5A059] disabled:opacity-50 transition-colors"
            >
              إرسال كود جديد
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

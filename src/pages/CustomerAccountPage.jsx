import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CheckCircle,
  Home,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerAuthModal from '../components/CustomerAuthModal';
import { supabase } from '../lib/supabase';
import {
  clearCustomerSession,
  getCustomerSession,
  normalizeCustomerPhone,
  updateCustomerSession,
} from '../utils/customerSession';
import logo from '../assets/logo-art-moment.svg';

const emptyProfile = {
  name: '',
  email: '',
  phone: '',
  marketingOptIn: false,
  preferredContactMethod: 'whatsapp',
  savedAddresses: [],
  dataDeletionRequestedAt: null,
};

const contactMethods = [
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'email', label: 'البريد الإلكتروني' },
  { value: 'phone', label: 'اتصال هاتفي' },
];

const errorMessages = {
  email_exists: 'البريد الإلكتروني مستخدم في حساب آخر.',
  phone_exists: 'رقم الجوال مستخدم في حساب آخر.',
  invalid_profile: 'راجعي الاسم والبريد ورقم الجوال قبل الحفظ.',
  invalid_current_password: 'كلمة المرور الحالية غير صحيحة.',
  weak_password: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.',
  unauthorized: 'انتهت جلسة الدخول. سجلي الدخول من جديد.',
};

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

function createAddress() {
  const fallbackId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: window.crypto?.randomUUID?.() || fallbackId,
    label: 'عنوان جديد',
    city: '',
    district: '',
    street: '',
    notes: '',
  };
}

function customerToProfile(customer) {
  return {
    ...emptyProfile,
    ...customer,
    phone: normalizeCustomerPhone(customer?.phone || ''),
    savedAddresses: Array.isArray(customer?.savedAddresses) ? customer.savedAddresses : [],
  };
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-xs font-black text-[#4A4A4A]/55">
        {Icon && <Icon size={14} className="text-[#C5A059]" />}
        {label}
      </span>
      {children}
    </label>
  );
}

export default function CustomerAccountPage() {
  const [session, setSession] = useState(() => getCustomerSession());
  const [profile, setProfile] = useState(emptyProfile);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const initials = useMemo(() => {
    const name = profile.name || session?.name || 'عميل';
    return name.trim().charAt(0) || 'ع';
  }, [profile.name, session?.name]);

  const invokeAccount = useCallback(async (action, payload = {}) => {
    const activeSession = getCustomerSession();
    if (!activeSession?.sessionToken) throw new Error('unauthorized');

    const { data, error } = await supabase.functions.invoke('customer-account', {
      body: {
        action,
        sessionToken: activeSession.sessionToken,
        ...payload,
      },
    });

    if (error) throw new Error(await getFunctionError(error));
    return data;
  }, []);

  const loadAccount = useCallback(async () => {
    const activeSession = getCustomerSession();
    setSession(activeSession);

    if (!activeSession?.sessionToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await invokeAccount('get');
      setProfile(customerToProfile(data.customer));
      updateCustomerSession({
        name: data.customer?.name,
        email: data.customer?.email,
        phone: normalizeCustomerPhone(data.customer?.phone),
        marketingOptIn: data.customer?.marketingOptIn,
      });
    } catch (error) {
      console.error(error);
      if (error.message === 'unauthorized') {
        clearCustomerSession();
        setSession(null);
      }
      toast.error(errorMessages[error.message] || 'تعذر تحميل بيانات الحساب حالياً.');
    } finally {
      setLoading(false);
    }
  }, [invokeAccount]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const updateProfileField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updateAddress = (index, field, value) => {
    setProfile((current) => ({
      ...current,
      savedAddresses: current.savedAddresses.map((address, addressIndex) => (
        addressIndex === index ? { ...address, [field]: value } : address
      )),
    }));
  };

  const addAddress = () => {
    if (profile.savedAddresses.length >= 5) {
      toast.error('يمكن حفظ 5 عناوين كحد أقصى.');
      return;
    }
    setProfile((current) => ({
      ...current,
      savedAddresses: [...current.savedAddresses, createAddress()],
    }));
  };

  const removeAddress = (index) => {
    setProfile((current) => ({
      ...current,
      savedAddresses: current.savedAddresses.filter((_, addressIndex) => addressIndex !== index),
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const data = await invokeAccount('update_profile', {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        marketingOptIn: profile.marketingOptIn,
        preferredContactMethod: profile.preferredContactMethod,
        savedAddresses: profile.savedAddresses,
      });
      const nextProfile = customerToProfile(data.customer);
      setProfile(nextProfile);
      const nextSession = updateCustomerSession({
        name: nextProfile.name,
        email: nextProfile.email,
        phone: nextProfile.phone,
        marketingOptIn: nextProfile.marketingOptIn,
      });
      setSession(nextSession);
      toast.success('تم تحديث بيانات الحساب بنجاح.');
    } catch (error) {
      console.error(error);
      toast.error(errorMessages[error.message] || 'تعذر حفظ بيانات الحساب حالياً.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setChangingPassword(true);
    try {
      await invokeAccount('change_password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('تم تغيير كلمة المرور بنجاح.');
    } catch (error) {
      console.error(error);
      toast.error(errorMessages[error.message] || 'تعذر تغيير كلمة المرور حالياً.');
    } finally {
      setChangingPassword(false);
    }
  };

  const requestDataDeletion = async () => {
    if (!window.confirm('هل تريدين إرسال طلب حذف بيانات الحساب للإدارة؟')) return;

    setRequestingDeletion(true);
    try {
      const data = await invokeAccount('request_data_deletion');
      setProfile(customerToProfile(data.customer));
      toast.success('تم إرسال طلب حذف البيانات للمراجعة.');
    } catch (error) {
      console.error(error);
      toast.error('تعذر إرسال طلب حذف البيانات حالياً.');
    } finally {
      setRequestingDeletion(false);
    }
  };

  if (!session && !loading) {
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
            <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-[#D9A3AA]/10 text-[#D9A3AA] flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-2xl font-black mb-3">حساب العميل</h1>
            <p className="text-sm leading-7 text-[#4A4A4A]/60 mb-6">
              سجلي الدخول أولاً لعرض بياناتك، عناوينك، وتفضيلات التواصل بشكل آمن.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full rounded-2xl bg-[#4A4A4A] px-6 py-4 text-sm font-black text-white shadow-md hover:bg-[#D9A3AA] transition-colors"
            >
              تسجيل الدخول
            </button>
          </section>
        </main>
        <CustomerAuthModal
          isOpen={isAuthModalOpen}
          redirectTo="/store/account"
          onClose={() => {
            setIsAuthModalOpen(false);
            loadAccount();
          }}
        />
      </div>
    );
  }

  return (
    <div className="art-page min-h-screen font-sans text-[#4A4A4A] pb-20" dir="rtl">
      <header className="art-nav art-nav-scrolled sticky top-0 z-40">
        <div className="art-shell h-16 flex items-center justify-between">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm font-black text-[#4A4A4A]/60 hover:text-[#D9A3AA]">
            <ArrowRight size={18} /> المتجر
          </Link>
          <img src={logo} alt="لحظة فن" className="h-9 w-auto" />
          <Link to="/store/orders" className="h-10 w-10 rounded-full border border-[#D9A3AA]/20 bg-white flex items-center justify-center text-[#4A4A4A]/60 hover:text-[#D9A3AA]">
            <ShoppingBag size={17} />
          </Link>
        </div>
      </header>

      <main className="art-shell py-8 sm:py-10">
        <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <span className="text-xs font-black text-[#C5A059]">حساب العميل</span>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black">حسابي</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4A4A4A]/60">
              بياناتك محفوظة خلف جلسة آمنة، ويمكنك تحديثها بدون كشف جداول العملاء مباشرة للمتصفح.
            </p>
          </div>
          <div className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-5 shadow-sm flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] text-white flex items-center justify-center text-2xl font-black shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black truncate">{profile.name || session?.name || 'عميل لحظة فن'}</p>
              <p className="text-xs font-mono text-[#4A4A4A]/55 truncate" dir="ltr">{profile.phone || session?.phone}</p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-10 flex items-center justify-center gap-3 text-[#4A4A4A]/60">
            <Loader2 size={20} className="animate-spin text-[#D9A3AA]" />
            جاري تحميل بيانات الحساب...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.6fr)]">
            <form onSubmit={saveProfile} className="space-y-6">
              <section className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-5 sm:p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                      <User size={20} className="text-[#C5A059]" /> بيانات الحساب
                    </h2>
                    <p className="mt-1 text-xs text-[#4A4A4A]/55">تستخدم في الطلبات، الدعم، والفواتير.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600 border border-emerald-100">
                    <CheckCircle size={13} /> جلسة آمنة
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="الاسم" icon={User}>
                    <input
                      value={profile.name}
                      onChange={updateProfileField('name')}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      required
                    />
                  </Field>
                  <Field label="البريد الإلكتروني" icon={Mail}>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={updateProfileField('email')}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      dir="ltr"
                      required
                    />
                  </Field>
                  <Field label="رقم الجوال" icon={User}>
                    <input
                      value={profile.phone}
                      onChange={updateProfileField('phone')}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      dir="ltr"
                      required
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-5 sm:p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                      <Bell size={20} className="text-[#C5A059]" /> تفضيلات التواصل
                    </h2>
                    <p className="mt-1 text-xs text-[#4A4A4A]/55">العروض التسويقية ترسل فقط عند الموافقة.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label="طريقة التواصل المفضلة" icon={Bell}>
                    <select
                      value={profile.preferredContactMethod}
                      onChange={updateProfileField('preferredContactMethod')}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                    >
                      {contactMethods.map((method) => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-sm">استقبال العروض</p>
                      <p className="mt-1 text-xs text-[#4A4A4A]/55">يمكن إلغاء الاشتراك في أي وقت.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.marketingOptIn}
                      onChange={updateProfileField('marketingOptIn')}
                      className="h-5 w-5 accent-[#D9A3AA]"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-5 sm:p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                      <MapPin size={20} className="text-[#C5A059]" /> العناوين المحفوظة
                    </h2>
                    <p className="mt-1 text-xs text-[#4A4A4A]/55">تسرّع تعبئة بيانات التوصيل في الطلبات القادمة.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/20 px-4 py-2 text-xs font-black hover:bg-[#D9A3AA]/10 transition-colors"
                  >
                    <Plus size={15} /> إضافة عنوان
                  </button>
                </div>

                {profile.savedAddresses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#D9A3AA]/25 bg-[#F8F5F2]/70 p-6 text-center text-sm font-bold text-[#4A4A4A]/50">
                    لا توجد عناوين محفوظة بعد.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profile.savedAddresses.map((address, index) => (
                      <div key={address.id || index} className="rounded-2xl border border-[#D9A3AA]/12 bg-[#F8F5F2]/70 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <input
                            value={address.label || ''}
                            onChange={(event) => updateAddress(index, 'label', event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none"
                            placeholder="اسم العنوان"
                          />
                          <button
                            type="button"
                            onClick={() => removeAddress(index)}
                            className="h-9 w-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                            title="حذف العنوان"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {['city', 'district', 'street'].map((field) => (
                            <input
                              key={field}
                              value={address[field] || ''}
                              onChange={(event) => updateAddress(index, field, event.target.value)}
                              placeholder={field === 'city' ? 'المدينة' : field === 'district' ? 'الحي' : 'الشارع'}
                              className="rounded-xl border border-white bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                            />
                          ))}
                        </div>
                        <textarea
                          value={address.notes || ''}
                          onChange={(event) => updateAddress(index, 'notes', event.target.value)}
                          placeholder="ملاحظات إضافية"
                          rows={2}
                          className="mt-3 w-full resize-none rounded-xl border border-white bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="mt-5 w-full rounded-2xl bg-[#4A4A4A] px-5 py-4 text-sm font-black text-white shadow-md hover:bg-[#D9A3AA] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {savingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  حفظ التغييرات
                </button>
              </section>
            </form>

            <aside className="space-y-6">
              <form onSubmit={changePassword} className="rounded-[2rem] bg-white border border-[#D9A3AA]/15 p-5 sm:p-6 shadow-sm">
                <h2 className="text-xl font-black flex items-center gap-2 mb-5">
                  <Lock size={20} className="text-[#C5A059]" /> كلمة المرور
                </h2>
                <div className="space-y-4">
                  <Field label="كلمة المرور الحالية" icon={Lock}>
                    <input
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      required
                    />
                  </Field>
                  <Field label="كلمة المرور الجديدة" icon={Lock}>
                    <input
                      type="password"
                      value={passwords.newPassword}
                      onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      minLength={6}
                      required
                    />
                  </Field>
                  <Field label="تأكيد كلمة المرور" icon={Lock}>
                    <input
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                      className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                      minLength={6}
                      required
                    />
                  </Field>
                </div>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="mt-5 w-full rounded-2xl bg-[#C5A059] px-5 py-4 text-sm font-black text-white shadow-md hover:bg-[#4A4A4A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {changingPassword ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                  تغيير كلمة المرور
                </button>
              </form>

              <section className="rounded-[2rem] bg-white border border-red-100 p-5 sm:p-6 shadow-sm">
                <h2 className="text-xl font-black flex items-center gap-2 mb-3 text-red-500">
                  <X size={20} /> حذف البيانات
                </h2>
                <p className="text-sm leading-7 text-[#4A4A4A]/60">
                  عند طلب حذف البيانات سيتم إرسال الطلب للإدارة للمراجعة قبل تنفيذ أي إجراء نهائي على الحساب والطلبات.
                </p>
                {profile.dataDeletionRequestedAt ? (
                  <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 p-4 text-sm font-black text-red-500">
                    تم تسجيل طلب حذف البيانات مسبقاً.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={requestDataDeletion}
                    disabled={requestingDeletion}
                    className="mt-5 w-full rounded-2xl bg-red-50 px-5 py-4 text-sm font-black text-red-500 hover:bg-red-100 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {requestingDeletion ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    طلب حذف البيانات
                  </button>
                )}
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

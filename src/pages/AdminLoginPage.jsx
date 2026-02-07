// src/pages/AdminLoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo-art-moment.svg';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
    e.preventDefault();
    
    // التحقق المبدئي
    if (!email || !password) {
      toast.error('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      setLoading(true);
      
      // محاولة تسجيل الدخول عبر Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // ترجمة الأخطاء الشائعة للعربية
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
        throw error;
      }

      // نجاح الدخول
      toast.success('تم تسجيل الدخول بنجاح! جاري التوجيه...');
      
      // التوجيه للوحة التحكم
      // (ملاحظة: AuthContext سيحدث الحالة تلقائياً، لكننا نوجه المستخدم يدوياً للسرعة)
      navigate('/app/dashboard', { replace: true });

    } catch (err) {
      console.error('Login error:', err);
      toast.error(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#F8F5F2] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-[#D9A3AA]/25 p-6 md:p-8 space-y-6">
        
        {/* الترويسة والشعار */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#4A4A4A]/60 mb-1">لوحة التحكم</p>
            <h1 className="text-lg md:text-xl font-semibold text-[#4A4A4A]">
              تسجيل دخول المسؤول
            </h1>
          </div>
          <img
            src={logoImg}
            alt="Art Moment Logo"
            className="w-12 h-12 rounded-2xl border border-[#D9A3AA]/25 object-contain bg-[#F8F5F2]"
          />
        </div>

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* حقل البريد الإلكتروني */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#4A4A4A]">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[#D9A3AA]/25 bg-[#F8F5F2] px-4 py-3 text-sm text-left dir-ltr focus:outline-none focus:ring-2 focus:ring-[#D9A3AA] focus:border-[#D9A3AA] transition-all"
              placeholder="admin@example.com"
              dir="ltr"
              required
            />
          </div>

          {/* حقل كلمة المرور */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#4A4A4A]">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[#D9A3AA]/25 bg-[#F8F5F2] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A3AA] focus:border-[#D9A3AA] transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {/* زر الدخول */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-2xl text-sm font-bold bg-[#D9A3AA] text-white hover:bg-[#C5A059] disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري التحقق...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>

          {/* زر الرجوع */}
          <button
            type="button"
            onClick={handleBackToHome}
            className="w-full px-4 py-3 rounded-2xl text-sm font-medium border border-[#D9A3AA]/25 text-[#4A4A4A]/70 hover:bg-[#F8F5F2] transition-all"
          >
            الرجوع للصفحة الرئيسية
          </button>
        </form>
      </div>
    </div>
  );
}
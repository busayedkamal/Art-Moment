// src/pages/AdminLoginPage.jsx
import { useMemo, useState } from 'react';
import { loadSettings } from '../storage/settingsStorage.js';
import {
  startAdminSession,
  clearAdminSession,
  MAX_INACTIVE_MINUTES,
} from '../utils/adminSession.js';

import logoImg from '../assets/logo-art-moment.svg';

// إزالة الفراغات + تحويل الأرقام العربية إلى إنجليزية
function normalizeCode(value) {
  let str = String(value ?? '');
  str = str.replace(/\s+/g, '');

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  str = str.replace(/[٠-٩]/g, (d) => {
    const idx = arabicDigits.indexOf(d);
    return idx >= 0 ? String(idx) : d;
  });

  return str;
}

export default function AdminLoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const expectedCode = useMemo(() => {
    const settings = loadSettings() || {};
    // نعتمد مفتاح واحد واضح: adminLoginCode (افتراضي 1234)
    const raw = typeof settings.adminLoginCode !== 'undefined' ? settings.adminLoginCode : '1234';
    return normalizeCode(raw || '1234');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const entered = normalizeCode(code);

    if (!entered) {
      setError('من فضلك أدخل رمز الدخول.');
      return;
    }

    if (entered !== expectedCode) {
      setError('رمز الدخول غير صحيح.');
      return;
    }

    // نجاح
    startAdminSession();

    // تنقّل مع تحديث كامل لتجنب أي حالة قديمة
    window.location.href = '/app';
  };

  const handleBackToHome = () => {
    clearAdminSession();
    window.location.href = '/';
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500 mb-1">لوحة تحكم</p>
            <h1 className="text-lg md:text-xl font-semibold text-slate-900">
              لحظة فن – دخول المسؤول
            </h1>
          </div>
          <img
            src={logoImg}
            alt="Art Moment Logo"
            className="w-12 h-12 rounded-2xl border border-slate-200 object-contain bg-slate-50"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs text-slate-600">
              رمز الدخول للوحة التحكم
            </label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            دخول للوحة التحكم
          </button>

          <button
            type="button"
            onClick={handleBackToHome}
            className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            ← الرجوع للصفحة الرئيسية
          </button>

          <p className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">
            تنتهي جلسة المسؤول تلقائياً بعد {MAX_INACTIVE_MINUTES} دقيقة من الخمول.
          </p>
        </form>
      </div>
    </div>
  );
}

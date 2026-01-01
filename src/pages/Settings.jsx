// src/pages/Settings.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Save, Banknote, Truck, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // القيم الافتراضية
  const [config, setConfig] = useState({
    a4_price: 2,
    photo_4x6_price: 1,
    delivery_fee_default: 0
  });

  // جلب الإعدادات عند فتح الصفحة
  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1) // نجلب الصف رقم 1 دائماً
        .single();

      if (error) throw error;
      if (data) setConfig(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('فشل جلب الإعدادات');
    } finally {
      setLoading(false);
    }
  }

  // حفظ التغييرات
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 1, ...config }); // upsert تعني: حدّث الموجود أو أنشئ جديداً

      if (error) throw error;
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-10 text-center">جاري تحميل الإعدادات...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-slate-900 text-white rounded-xl">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إعدادات النظام</h1>
          <p className="text-sm text-slate-500">تحكم في الأسعار الافتراضية للطباعة والتوصيل.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* بطاقة الأسعار */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Banknote className="text-emerald-600" size={20} />
            أسعار الطباعة (الافتراضية)
          </h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">سعر صورة A4</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={config.a4_price}
                  onChange={(e) => setConfig({ ...config, a4_price: e.target.value })}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ر.س</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">سعر صورة 4×6</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={config.photo_4x6_price}
                  onChange={(e) => setConfig({ ...config, photo_4x6_price: e.target.value })}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ر.س</span>
              </div>
            </div>
          </div>
        </div>

        {/* بطاقة التوصيل */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="text-blue-600" size={20} />
            إعدادات التوصيل
          </h3>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">سعر التوصيل الافتراضي</label>
            <div className="relative">
              <input
                type="number"
                value={config.delivery_fee_default}
                onChange={(e) => setConfig({ ...config, delivery_fee_default: e.target.value })}
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ر.س</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">سيتم تعبئة هذا السعر تلقائياً عند إنشاء طلب جديد.</p>
          </div>
        </div>

        {/* زر الحفظ */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
        >
          {saving ? 'جاري الحفظ...' : (
            <>
              <Save size={20} /> حفظ التغييرات
            </>
          )}
        </button>
      </form>
    </div>
  );
}
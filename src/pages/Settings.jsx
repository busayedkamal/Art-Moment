// src/pages/Settings.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Save, Banknote, Truck, Settings as SettingsIcon, Tag, Trash2, Plus } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState([]); // قائمة الكوبونات
  
  // القيم الافتراضية
  const [config, setConfig] = useState({
    a4_price: 2,
    photo_4x6_price: 1,
    delivery_fee_default: 0
  });

  // حالة الكوبون الجديد
  const [newCoupon, setNewCoupon] = useState({ code: '', amount: '' });

  useEffect(() => {
    fetchSettings();
    fetchCoupons();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (error) throw error;
      if (data) setConfig(data);
    } catch (error) { toast.error('فشل جلب الإعدادات'); } finally { setLoading(false); }
  }

  // جلب الكوبونات
  async function fetchCoupons() {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (data) setCoupons(data);
  }

  // إضافة كوبون
  async function handleAddCoupon(e) {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.amount) return;

    const { data, error } = await supabase
      .from('coupons')
      .insert([{ 
        code: newCoupon.code.toUpperCase(), 
        discount_amount: newCoupon.amount 
      }])
      .select()
      .single();

    if (error) {
      toast.error('الكود موجود مسبقاً أو حدث خطأ');
    } else {
      setCoupons([data, ...coupons]);
      setNewCoupon({ code: '', amount: '' });
      toast.success('تمت إضافة الكوبون');
    }
  }

  // حذف كوبون
  async function handleDeleteCoupon(id) {
    await supabase.from('coupons').delete().eq('id', id);
    setCoupons(coupons.filter(c => c.id !== id));
    toast.success('تم الحذف');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('settings').upsert({ id: 1, ...config });
      if (error) throw error;
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) { toast.error('حدث خطأ أثناء الحفظ'); } finally { setSaving(false); }
  }

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-slate-900 text-white rounded-xl"><SettingsIcon size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إعدادات النظام</h1>
          <p className="text-sm text-slate-500">تحكم في الأسعار والكوبونات.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. إعدادات الأسعار */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Banknote className="text-emerald-600" size={20} /> أسعار الطباعة
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">سعر صورة A4</label>
              <input type="number" step="0.1" value={config.a4_price} onChange={(e) => setConfig({ ...config, a4_price: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">سعر صورة 4×6</label>
              <input type="number" step="0.1" value={config.photo_4x6_price} onChange={(e) => setConfig({ ...config, photo_4x6_price: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        {/* 2. إعدادات التوصيل */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="text-blue-600" size={20} /> التوصيل الافتراضي
          </h3>
          <input type="number" value={config.delivery_fee_default} onChange={(e) => setConfig({ ...config, delivery_fee_default: e.target.value })} className="input-field" />
        </div>

        <button type="submit" disabled={saving} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 flex justify-center items-center gap-2">
          {saving ? 'جاري الحفظ...' : <><Save size={20} /> حفظ الإعدادات الأساسية</>}
        </button>
      </form>

      {/* 3. إدارة الكوبونات (قسم منفصل) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-8">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Tag className="text-orange-500" size={20} /> أكواد الخصم
        </h3>

        {/* نموذج الإضافة */}
        <div className="flex gap-2 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <input 
            type="text" 
            placeholder="كود الخصم (مثلاً SALE10)" 
            value={newCoupon.code}
            onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase outline-none focus:border-orange-500"
          />
          <input 
            type="number" 
            placeholder="قيمة الخصم" 
            value={newCoupon.amount}
            onChange={(e) => setNewCoupon({...newCoupon, amount: e.target.value})}
            className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
          <button onClick={handleAddCoupon} className="bg-orange-500 text-white px-4 rounded-lg hover:bg-orange-600 flex items-center">
            <Plus size={18} />
          </button>
        </div>

        {/* قائمة الكوبونات */}
        <div className="space-y-2">
          {coupons.length === 0 ? <p className="text-sm text-slate-400 text-center">لا توجد كوبونات حالياً</p> : 
            coupons.map((coupon) => (
              <div key={coupon.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800 bg-slate-200 px-2 py-1 rounded">{coupon.code}</span>
                  <span className="text-sm text-green-600 font-bold">خصم {coupon.discount_amount} ر.س</span>
                </div>
                <button onClick={() => handleDeleteCoupon(coupon.id)} className="text-red-400 hover:text-red-600 bg-white p-2 rounded-full border border-slate-200 shadow-sm">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          }
        </div>
      </div>
      
      <style>{`
        .input-field { @apply w-full pl-4 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none; }
      `}</style>
    </div>
  );
}
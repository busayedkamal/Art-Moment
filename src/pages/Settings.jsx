// src/pages/Settings.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Save, Loader2, Settings as SettingsIcon, Package, AlertTriangle, 
  Plus, Tag, Trash2, ToggleLeft, ToggleRight, Percent, Calculator, MessageCircle 
} from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  
  // إعدادات الأسعار + إعدادات واتساب الجديدة
  const [prices, setPrices] = useState({
    a4_price: 0,
    photo_4x6_price: 0,
    delivery_fee_default: 0,
    // حقول التسعير الديناميكي
    is_dynamic_pricing_enabled: false,
    tier_1_limit: 20, tier_1_price: 2,
    tier_2_limit: 50, tier_2_price: 1.5,
    tier_3_price: 1,
    // حقول واتساب (جديد)
    whatsapp_instance_id: '',
    whatsapp_token: '',
    whatsapp_enabled: false
  });

  // إعدادات المخزون
  const [inventory, setInventory] = useState([]);

  // إعدادات الكوبونات
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({ 
    code: '', 
    discount_type: 'fixed', // or 'percent'
    discount_amount: '' 
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. جلب الأسعار والإعدادات
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (settingsData) setPrices(settingsData);

      // 2. جلب المخزون
      const { data: inventoryData } = await supabase.from('inventory').select('*').order('id');
      if (inventoryData) setInventory(inventoryData);

      // 3. جلب الكوبونات
      const { data: couponsData } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (couponsData) setCoupons(couponsData);

    } catch (error) {
      toast.error('فشل تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  }

  // --- دوال الحفظ ---
  const handleSavePrices = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('settings').update(prices).eq('id', 1);
      if (error) throw error;
      toast.success('تم تحديث الإعدادات بنجاح');
    } catch { toast.error('فشل التحديث'); }
  };

  const toggleDynamicPricing = () => {
    setPrices(prev => ({ ...prev, is_dynamic_pricing_enabled: !prev.is_dynamic_pricing_enabled }));
  };

  // --- دوال المخزون ---
  const handleUpdateStock = async (id, field, value) => {
    const updatedInventory = inventory.map(item => 
      item.id === id ? { ...item, [field]: Number(value) } : item
    );
    setInventory(updatedInventory);
    try {
      await supabase.from('inventory').update({ [field]: Number(value) }).eq('id', id);
    } catch { toast.error('فشل الحفظ'); }
  };

  // --- دوال الكوبونات ---
  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discount_amount) return toast.error('أكمل البيانات');
    try {
      const { data, error } = await supabase.from('coupons').insert([{
        code: newCoupon.code.toUpperCase(),
        discount_type: newCoupon.discount_type,
        discount_amount: Number(newCoupon.discount_amount),
        is_active: true
      }]).select().single();
      if (error) throw error;
      setCoupons([data, ...coupons]);
      setNewCoupon({ code: '', discount_type: 'fixed', discount_amount: '' });
      toast.success('تم إضافة الكوبون');
    } catch (error) { toast.error('فشل الإضافة'); }
  };

  const toggleCouponStatus = async (id, currentStatus) => {
    try {
      await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
      setCoupons(coupons.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
      toast.success('تم تحديث الحالة');
    } catch { toast.error('فشل التحديث'); }
  };

  const deleteCoupon = async (id) => {
    if(!window.confirm('حذف الكوبون؟')) return;
    try {
      await supabase.from('coupons').delete().eq('id', id);
      setCoupons(coupons.filter(c => c.id !== id));
      toast.success('تم الحذف');
    } catch { toast.error('فشل الحذف'); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block"/> جاري التحميل...</div>;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 space-y-8 pb-10">
      
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#4A4A4A] text-white rounded-xl"><SettingsIcon size={24}/></div>
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A]">الإعدادات العامة</h1>
          <p className="text-sm text-[#4A4A4A]/60">التحكم في الأسعار، المخزون، واتساب، وأكواد الخصم.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        
        {/* 1. قسم الأسعار وواتساب */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm space-y-6">
          <h3 className="font-bold text-[#4A4A4A] mb-2 flex items-center gap-2">💰 تسعير وخدمات</h3>
          
          <form onSubmit={handleSavePrices} className="space-y-6">
            
            {/* الأسعار الأساسية */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">سعر طباعة A4</label>
                <input type="number" step="0.5" value={prices.a4_price} onChange={e => setPrices({...prices, a4_price: e.target.value})} className="w-full bg-[#F8F5F2] border rounded-xl px-4 py-2"/>
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">سعر طباعة 4x6 (الأساسي)</label>
                <input type="number" step="0.5" value={prices.photo_4x6_price} onChange={e => setPrices({...prices, photo_4x6_price: e.target.value})} className="w-full bg-[#F8F5F2] border rounded-xl px-4 py-2"/>
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">سعر التوصيل الافتراضي</label>
                <input type="number" value={prices.delivery_fee_default} onChange={e => setPrices({...prices, delivery_fee_default: e.target.value})} className="w-full bg-[#F8F5F2] border rounded-xl px-4 py-2"/>
              </div>
            </div>

            <hr className="border-[#D9A3AA]/15" />

            {/* قسم واتساب الجديد */}
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-600"/>
                  <span className="font-bold text-[#4A4A4A] text-sm">ربط واتساب (API)</span>
                </div>
                <button type="button" onClick={() => setPrices({...prices, whatsapp_enabled: !prices.whatsapp_enabled})} className="text-emerald-600 hover:text-emerald-700">
                  {prices.whatsapp_enabled ? <ToggleRight size={32}/> : <ToggleLeft size={32} className="text-[#4A4A4A]/50"/>}
                </button>
              </div>
              
              {prices.whatsapp_enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-800 block mb-1">Instance ID</label>
                    <input type="text" placeholder="instance..." value={prices.whatsapp_instance_id || ''} onChange={e => setPrices({...prices, whatsapp_instance_id: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-800 block mb-1">Token</label>
                    <input type="text" placeholder="token..." value={prices.whatsapp_token || ''} onChange={e => setPrices({...prices, whatsapp_token: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500"/>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    سيتم إرسال رسائل تلقائية عند تغيير الحالة إلى "تم التسليم".
                  </p>
                </div>
              )}
            </div>

            {/* قسم التسعير الديناميكي */}
            <div className="bg-[#D9A3AA]/10 p-4 rounded-xl border border-[#D9A3AA]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#D9A3AA]"/>
                  <span className="font-bold text-[#4A4A4A] text-sm">التسعير الذكي (الكميات)</span>
                </div>
                <button type="button" onClick={toggleDynamicPricing} className="text-[#D9A3AA] hover:text-[#C5A059]">
                  {prices.is_dynamic_pricing_enabled ? <ToggleRight size={32}/> : <ToggleLeft size={32} className="text-[#4A4A4A]/50"/>}
                </button>
              </div>

              {prices.is_dynamic_pricing_enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#4A4A4A]/60">من 1 إلى</label>
                      <input type="number" value={prices.tier_1_limit} onChange={e => setPrices({...prices, tier_1_limit: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center"/>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#4A4A4A]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_1_price} onChange={e => setPrices({...prices, tier_1_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#D9A3AA]"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#4A4A4A]/60">من {Number(prices.tier_1_limit) + 1} إلى</label>
                      <input type="number" value={prices.tier_2_limit} onChange={e => setPrices({...prices, tier_2_limit: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center"/>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#4A4A4A]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_2_price} onChange={e => setPrices({...prices, tier_2_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#D9A3AA]"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1 flex items-center h-full pt-4">
                      <span className="font-bold text-[#4A4A4A]/80">أكثر من {prices.tier_2_limit} صورة</span>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#4A4A4A]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_3_price} onChange={e => setPrices({...prices, tier_3_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#D9A3AA]"/>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-[#4A4A4A] text-white py-3 rounded-xl font-bold hover:bg-[#4A4A4A]/90 flex justify-center gap-2">
              <Save size={18}/> حفظ التغييرات
            </button>
          </form>
        </div>

        {/* 2. قسم المخزون */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <h3 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2"><Package className="text-[#C5A059]"/> إدارة المخزون</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {inventory.length === 0 ? (
              <p className="text-center text-[#4A4A4A]/50 py-4">لا توجد مواد في المخزون</p>
            ) : (
              inventory.map((item) => (
                <div key={item.id} className="p-3 border border-[#D9A3AA]/15 rounded-xl bg-[#F8F5F2]/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-[#4A4A4A]/80">{item.item_name}</span>
                    {item.quantity <= item.threshold && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold animate-pulse">
                        <AlertTriangle size={10}/> منخفض
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-[#4A4A4A]/50 block mb-1">الكمية الحالية</label>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => handleUpdateStock(item.id, 'quantity', e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1.5 text-center font-bold outline-none focus:ring-2 ${item.quantity <= item.threshold ? 'border-red-300 text-red-600 bg-red-50' : 'border-[#D9A3AA]/25'}`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-[#4A4A4A]/50 block mb-1">حد التنبيه</label>
                      <input 
                        type="number" 
                        value={item.threshold} 
                        onChange={(e) => handleUpdateStock(item.id, 'threshold', e.target.value)}
                        className="w-full border border-[#D9A3AA]/25 rounded-lg px-2 py-1.5 text-center bg-white outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. قسم أكواد الخصم */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <h3 className="font-bold text-[#4A4A4A] mb-6 flex items-center gap-2"><Tag className="text-[#D9A3AA]"/> أكواد الخصم</h3>
          
          <form onSubmit={handleAddCoupon} className="flex flex-col md:flex-row gap-4 mb-8 bg-[#F8F5F2] p-4 rounded-xl border border-[#D9A3AA]/15">
            <div className="flex-1">
              <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">الكود</label>
              <input 
                type="text" 
                placeholder="مثلاً SALE20" 
                className="w-full border rounded-xl px-4 py-2 uppercase"
                value={newCoupon.code}
                onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
              />
            </div>
            <div className="w-full md:w-40">
              <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">النوع</label>
              <select 
                className="w-full border rounded-xl px-4 py-2 bg-white"
                value={newCoupon.discount_type}
                onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})}
              >
                <option value="fixed">مبلغ ثابت (ر.س)</option>
                <option value="percent">نسبة مئوية (%)</option>
              </select>
            </div>
            <div className="w-full md:w-32">
              <label className="text-xs font-bold text-[#4A4A4A]/60 block mb-1">القيمة</label>
              <input 
                type="number" 
                placeholder="0" 
                className="w-full border rounded-xl px-4 py-2 text-center font-bold"
                value={newCoupon.discount_amount}
                onChange={e => setNewCoupon({...newCoupon, discount_amount: e.target.value})}
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-[#D9A3AA]/100 hover:bg-gradient-to-b from-[#D9A3AA] to-[#C5A059] text-white px-6 py-2 rounded-xl font-bold h-[42px] flex items-center gap-2 w-full md:w-auto justify-center">
                <Plus size={18}/> إضافة
              </button>
            </div>
          </form>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.length === 0 ? (
              <p className="col-span-full text-center text-[#4A4A4A]/50 py-4">لا توجد أكواد خصم حالياً</p>
            ) : (
              coupons.map(coupon => (
                <div key={coupon.id} className={`p-4 rounded-xl border flex justify-between items-center ${coupon.is_active ? 'bg-white border-[#D9A3AA]/20' : 'bg-[#F8F5F2] border-[#D9A3AA]/15 opacity-70'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#4A4A4A] text-lg">{coupon.code}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${coupon.is_active ? 'bg-[#D9A3AA]/15 text-[#D9A3AA]' : 'bg-[#D9A3AA]/10 text-[#4A4A4A]/60'}`}>
                        {coupon.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                    <div className="text-sm text-[#4A4A4A]/60 mt-1 flex items-center gap-1">
                      خصم: <span className="font-bold text-[#4A4A4A]/80">{coupon.discount_amount}</span> 
                      {coupon.discount_type === 'percent' ? <Percent size={12}/> : <span className="text-xs">ر.س</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleCouponStatus(coupon.id, coupon.is_active)} className="text-[#4A4A4A]/50 hover:text-[#4A4A4A]/70">
                      {coupon.is_active ? <ToggleRight size={28} className="text-[#D9A3AA]"/> : <ToggleLeft size={28}/>}
                    </button>
                    <button onClick={() => deleteCoupon(coupon.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg">
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
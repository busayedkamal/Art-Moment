// src/pages/Settings.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  Save, Loader2, Settings as SettingsIcon, Package, AlertTriangle,
  Plus, Tag, Trash2, ToggleLeft, ToggleRight, Percent, Calculator, MessageCircle,
  FileText, Edit3, XCircle, Mail, BellRing, Clock3, CreditCard, RotateCcw, Truck,
  Award, Coins, ShieldCheck
} from 'lucide-react';
import RiyalSign from '../components/RiyalSign';
import {
  DEFAULT_OPERATION_RULES,
  getOperationRulesPayload,
  normalizeOperationRules,
} from '../utils/operationRules';
import {
  DEFAULT_REWARD_RULES,
  getRewardRulesPayload,
  normalizeRewardRules,
  pointsToRewardValue,
} from '../utils/rewardPoints';

const emptyTemplateForm = {
  template_key: '',
  name: '',
  category: 'general',
  channel: 'email',
  subject: '',
  body: '',
  variablesText: '',
  is_active: true,
};

const templateCategories = [
  { value: 'order', label: 'الطلبات' },
  { value: 'payment', label: 'الدفع' },
  { value: 'shipping', label: 'الشحن' },
  { value: 'return', label: 'الاسترجاع' },
  { value: 'account', label: 'الحساب' },
  { value: 'marketing', label: 'التسويق' },
  { value: 'general', label: 'عام' },
];

const channelLabels = {
  email: 'بريد',
  whatsapp: 'واتساب',
  sms: 'SMS',
  system: 'نظام',
};

function normalizeTemplateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 80);
}

function parseVariables(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/[{}]/g, ''))
    .filter(Boolean);
}

function OperationRuleField({ icon, label, description, unit, value, onChange, min, max, step = 1 }) {
  return (
    <label className="grid gap-3 border-b border-[#E8B4BC]/10 py-4 last:border-b-0 sm:grid-cols-[44px_1fr_140px] sm:items-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF9F7] text-[#C6A56B]">
        {React.createElement(icon, { size: 19 })}
      </span>
      <span>
        <span className="block text-sm font-black text-[#171717]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#171717]/50">{description}</span>
      </span>
      <span className="flex h-11 items-center overflow-hidden rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] focus-within:border-[#C6A56B]">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-center text-sm font-black outline-none"
          dir="ltr"
        />
        <span className="border-r border-[#E8B4BC]/15 px-3 text-[11px] font-bold text-[#171717]/45">{unit}</span>
      </span>
    </label>
  );
}

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
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [operationRules, setOperationRules] = useState(DEFAULT_OPERATION_RULES);
  const [savingOperationRules, setSavingOperationRules] = useState(false);
  const [rewardRules, setRewardRules] = useState(DEFAULT_REWARD_RULES);
  const [savingRewardRules, setSavingRewardRules] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. جلب الأسعار والإعدادات
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (settingsData) {
        setPrices((current) => Object.fromEntries(
          Object.keys(current).map((key) => [key, settingsData[key] ?? current[key]]),
        ));
        setOperationRules(normalizeOperationRules(settingsData));
        setRewardRules(normalizeRewardRules(settingsData));
      }

      // 2. جلب المخزون
      const { data: inventoryData } = await supabase.from('inventory').select('*').order('id');
      if (inventoryData) {
        setInventory(inventoryData.filter(item => !/ألبوم|البوم|album/i.test(String(item.item_name || ''))));
      }

      // 3. جلب الكوبونات
      const { data: couponsData } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (couponsData) setCoupons(couponsData);

      const { data: templatesData, error: templatesError } = await supabase
        .from('customer_message_templates')
        .select('*')
        .order('category')
        .order('name');
      if (templatesError) {
        if (!/customer_message_templates|schema cache|relation|does not exist/i.test(templatesError.message || '')) {
          throw templatesError;
        }
      } else {
        setMessageTemplates(templatesData || []);
      }

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

  const updateOperationRule = (key, value) => {
    setOperationRules((current) => ({ ...current, [key]: value }));
  };

  const handleSaveOperationRules = async (event) => {
    event.preventDefault();
    const payload = getOperationRulesPayload(operationRules);
    setSavingOperationRules(true);
    try {
      const { error } = await supabase.from('settings').update(payload).eq('id', 1);
      if (error) throw error;
      setOperationRules(normalizeOperationRules(payload));
      toast.success('تم حفظ قواعد التشغيل وتطبيقها على مركز المهام');
    } catch (error) {
      console.error(error);
      toast.error(/column|schema cache/i.test(error?.message || '')
        ? 'شغّل ملف SQL الخاص بقواعد التشغيل أولاً'
        : 'تعذر حفظ قواعد التشغيل');
    } finally {
      setSavingOperationRules(false);
    }
  };

  const updateRewardRule = (key, value) => {
    setRewardRules((current) => ({ ...current, [key]: value }));
  };

  const handleSaveRewardRules = async (event) => {
    event.preventDefault();
    const payload = getRewardRulesPayload(rewardRules);
    setSavingRewardRules(true);
    try {
      const { error } = await supabase.from('settings').update(payload).eq('id', 1);
      if (error) throw error;
      setRewardRules(normalizeRewardRules(payload));
      toast.success('تم حفظ نظام المكافآت بصلاحية 4 أشهر');
    } catch (error) {
      console.error(error);
      toast.error(/column|schema cache/i.test(error?.message || '')
        ? 'شغّل ملف SQL الخاص بنظام المكافآت أولاً'
        : 'تعذر حفظ نظام المكافآت');
    } finally {
      setSavingRewardRules(false);
    }
  };

  const editTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      template_key: template.template_key || '',
      name: template.name || '',
      category: template.category || 'general',
      channel: template.channel || 'email',
      subject: template.subject || '',
      body: template.body || '',
      variablesText: Array.isArray(template.variables) ? template.variables.join(', ') : '',
      is_active: template.is_active !== false,
    });
  };

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm);
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    const templateKey = normalizeTemplateKey(templateForm.template_key || templateForm.name);
    if (!templateKey || !templateForm.name.trim() || !templateForm.body.trim()) {
      toast.error('أكمل مفتاح القالب والاسم ونص الرسالة');
      return;
    }

    const payload = {
      template_key: templateKey,
      name: templateForm.name.trim(),
      category: templateForm.category,
      channel: templateForm.channel,
      subject: templateForm.subject.trim() || null,
      body: templateForm.body.trim(),
      variables: parseVariables(templateForm.variablesText),
      is_active: templateForm.is_active,
    };

    setSavingTemplate(true);
    try {
      if (editingTemplateId) {
        const { data, error } = await supabase
          .from('customer_message_templates')
          .update(payload)
          .eq('id', editingTemplateId)
          .select()
          .single();
        if (error) throw error;
        setMessageTemplates((current) => current.map((item) => item.id === editingTemplateId ? data : item));
        toast.success('تم تحديث القالب');
      } else {
        const { data, error } = await supabase
          .from('customer_message_templates')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setMessageTemplates((current) => [...current, data].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar')));
        toast.success('تم إضافة القالب');
      }
      resetTemplateForm();
    } catch (error) {
      console.error(error);
      toast.error('تعذر حفظ القالب. تأكد من تشغيل ملف SQL الخاص بالقوالب.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleTemplateStatus = async (template) => {
    try {
      const { error } = await supabase
        .from('customer_message_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);
      if (error) throw error;
      setMessageTemplates((current) => current.map((item) => item.id === template.id ? { ...item, is_active: !template.is_active } : item));
      toast.success('تم تحديث حالة القالب');
    } catch {
      toast.error('تعذر تحديث القالب');
    }
  };

  const deleteTemplate = async (template) => {
    if (!window.confirm(`حذف قالب "${template.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('customer_message_templates')
        .delete()
        .eq('id', template.id);
      if (error) throw error;
      setMessageTemplates((current) => current.filter((item) => item.id !== template.id));
      if (editingTemplateId === template.id) resetTemplateForm();
      toast.success('تم حذف القالب');
    } catch {
      toast.error('تعذر حذف القالب');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <Loader2 className="animate-spin text-[#E8B4BC] mb-4" size={36}/>
      <p className="text-sm text-[#171717]/50 font-medium">جاري التحميل...</p>
    </div>
  );

  return (
    <div className="w-full space-y-8 pb-10 text-[#171717]">

      <div className="flex items-center gap-3 pt-1">
        <div className="p-3 bg-[#171717] text-white rounded-xl shadow-lg shadow-[#171717]/20">
          <SettingsIcon size={22}/>
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#171717] tracking-tight">الإعدادات العامة</h1>
          <p className="text-sm text-[#171717]/50">التحكم في قواعد التشغيل، الأسعار، المخزون، الرسائل، وأكواد الخصم</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        
        {/* 1. قسم الأسعار وواتساب */}
        <div className="bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm space-y-6">
          <h3 className="font-bold text-[#171717] mb-2 flex items-center gap-2">💰 تسعير وخدمات</h3>
          
          <form onSubmit={handleSavePrices} className="space-y-6">
            
            {/* الأسعار الأساسية */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#171717]/60 block mb-1">سعر طباعة A4</label>
                <input type="number" step="0.5" value={prices.a4_price} onChange={e => setPrices({...prices, a4_price: e.target.value})} className="w-full bg-[#FAF9F7] border rounded-xl px-4 py-2"/>
              </div>
              <div>
                <label className="text-xs font-bold text-[#171717]/60 block mb-1">سعر طباعة 4x6 (الأساسي)</label>
                <input type="number" step="0.5" value={prices.photo_4x6_price} onChange={e => setPrices({...prices, photo_4x6_price: e.target.value})} className="w-full bg-[#FAF9F7] border rounded-xl px-4 py-2"/>
              </div>
              <div>
                <label className="text-xs font-bold text-[#171717]/60 block mb-1">سعر التوصيل الافتراضي</label>
                <input type="number" value={prices.delivery_fee_default} onChange={e => setPrices({...prices, delivery_fee_default: e.target.value})} className="w-full bg-[#FAF9F7] border rounded-xl px-4 py-2"/>
              </div>
            </div>

            <hr className="border-[#E8B4BC]/15" />

            {/* قسم واتساب الجديد */}
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-600"/>
                  <span className="font-bold text-[#171717] text-sm">ربط واتساب (API)</span>
                </div>
                <button type="button" onClick={() => setPrices({...prices, whatsapp_enabled: !prices.whatsapp_enabled})} className="text-emerald-600 hover:text-emerald-700">
                  {prices.whatsapp_enabled ? <ToggleRight size={32}/> : <ToggleLeft size={32} className="text-[#171717]/50"/>}
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
            <div className="bg-[#E8B4BC]/10 p-4 rounded-xl border border-[#E8B4BC]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#E8B4BC]"/>
                  <span className="font-bold text-[#171717] text-sm">التسعير الذكي (الكميات)</span>
                </div>
                <button type="button" onClick={toggleDynamicPricing} className="text-[#E8B4BC] hover:text-[#C6A56B]">
                  {prices.is_dynamic_pricing_enabled ? <ToggleRight size={32}/> : <ToggleLeft size={32} className="text-[#171717]/50"/>}
                </button>
              </div>

              {prices.is_dynamic_pricing_enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#171717]/60">من 1 إلى</label>
                      <input type="number" value={prices.tier_1_limit} onChange={e => setPrices({...prices, tier_1_limit: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center"/>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#171717]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_1_price} onChange={e => setPrices({...prices, tier_1_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#E8B4BC]"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#171717]/60">من {Number(prices.tier_1_limit) + 1} إلى</label>
                      <input type="number" value={prices.tier_2_limit} onChange={e => setPrices({...prices, tier_2_limit: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center"/>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#171717]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_2_price} onChange={e => setPrices({...prices, tier_2_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#E8B4BC]"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1 flex items-center h-full pt-4">
                      <span className="font-bold text-[#171717]/80">أكثر من {prices.tier_2_limit} صورة</span>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#171717]/60">السعر (ريال)</label>
                      <input type="number" step="0.1" value={prices.tier_3_price} onChange={e => setPrices({...prices, tier_3_price: e.target.value})} className="w-full bg-white border rounded-lg px-2 py-1.5 text-center font-bold text-[#E8B4BC]"/>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-[#171717] text-white py-3 rounded-xl font-bold hover:bg-[#171717]/90 flex justify-center gap-2">
              <Save size={18}/> حفظ التغييرات
            </button>
          </form>
        </div>

        {/* 2. قسم المخزون */}
        <div className="bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <h3 className="font-bold text-[#171717] mb-4 flex items-center gap-2"><Package className="text-[#C6A56B]"/> إدارة المخزون</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {inventory.length === 0 ? (
              <p className="text-center text-[#171717]/50 py-4">لا توجد مواد في المخزون</p>
            ) : (
              inventory.map((item) => (
                <div key={item.id} className="p-3 border border-[#E8B4BC]/15 rounded-xl bg-[#FAF9F7]/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-[#171717]/80">{item.item_name}</span>
                    {item.quantity <= item.threshold && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold animate-pulse">
                        <AlertTriangle size={10}/> منخفض
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-[#171717]/50 block mb-1">الكمية الحالية</label>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => handleUpdateStock(item.id, 'quantity', e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1.5 text-center font-bold outline-none focus:ring-2 ${item.quantity <= item.threshold ? 'border-red-300 text-red-600 bg-red-50' : 'border-[#E8B4BC]/25'}`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-[#171717]/50 block mb-1">حد التنبيه</label>
                      <input 
                        type="number" 
                        value={item.threshold} 
                        onChange={(e) => handleUpdateStock(item.id, 'threshold', e.target.value)}
                        className="w-full border border-[#E8B4BC]/25 rounded-lg px-2 py-1.5 text-center bg-white outline-none focus:border-[#C6A56B]"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. قواعد التشغيل */}
        <form onSubmit={handleSaveOperationRules} className="md:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E8B4BC]/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-[#171717]">
                <Clock3 size={20} className="text-[#C6A56B]" /> قواعد التشغيل
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#171717]/50">
                تحدد متى يظهر التنبيه، ومتى تتحول المهمة المتأخرة إلى عاجلة، وما الحدود المسموحة للعميل والإدارة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOperationRules(DEFAULT_OPERATION_RULES)}
              className="shrink-0 text-xs font-black text-[#171717]/55 hover:text-[#C6A56B]"
            >
              استعادة القيم الافتراضية
            </button>
          </div>

          <div className="grid gap-x-8 lg:grid-cols-2">
            <OperationRuleField
              icon={Package}
              label="حد المخزون المنخفض"
              description="يظهر المنتج في مركز المهام عندما تصل كميته إلى هذا الرقم أو أقل."
              unit="قطعة"
              min={0}
              max={100000}
              value={operationRules.lowStockThreshold}
              onChange={(value) => updateOperationRule('lowStockThreshold', value)}
            />
            <OperationRuleField
              icon={CreditCard}
              label="مدة اعتبار الدفع متأخرًا"
              description="بعدها يتحول طلب الدفع المعلّق إلى مهمة متجاوزة للمهلة."
              unit="ساعة"
              min={1}
              max={720}
              value={operationRules.paymentOverdueHours}
              onChange={(value) => updateOperationRule('paymentOverdueHours', value)}
            />
            <OperationRuleField
              icon={Truck}
              label="مهلة إضافة رقم التتبع"
              description="المدة المتاحة بعد جاهزية الطلب للشحن قبل ظهور تنبيه متأخر."
              unit="ساعة"
              min={1}
              max={720}
              value={operationRules.trackingDueHours}
              onChange={(value) => updateOperationRule('trackingDueHours', value)}
            />
            <OperationRuleField
              icon={RotateCcw}
              label="مهلة مراجعة الاسترجاع"
              description="المدة المستهدفة لمراجعة طلب الاسترجاع المفتوح وتحديث حالته."
              unit="ساعة"
              min={1}
              max={720}
              value={operationRules.returnReviewDueHours}
              onChange={(value) => updateOperationRule('returnReviewDueHours', value)}
            />
            <OperationRuleField
              icon={RotateCcw}
              label="أيام السماح بالاسترجاع"
              description="يرفض النظام طلب الاسترجاع بعد انتهاء هذه المدة من آخر تحديث للطلب."
              unit="يوم"
              min={1}
              max={365}
              value={operationRules.returnWindowDays}
              onChange={(value) => updateOperationRule('returnWindowDays', value)}
            />
            <OperationRuleField
              icon={BellRing}
              label="حد إعادة إرسال الإشعار"
              description="أقصى عدد لمحاولات إعادة إرسال الرسالة الفاشلة نفسها."
              unit="محاولة"
              min={0}
              max={10}
              value={operationRules.notificationRetryLimit}
              onChange={(value) => updateOperationRule('notificationRetryLimit', value)}
            />
            <OperationRuleField
              icon={Trash2}
              label="حذف مسودات الصور غير المكتملة"
              description="تُحذف الصور التي رُفعت ولم تتحول إلى طلب بعد هذه المدة."
              unit="يوم"
              min={1}
              max={30}
              value={operationRules.printDraftRetentionDays}
              onChange={(value) => updateOperationRule('printDraftRetentionDays', value)}
            />
            <OperationRuleField
              icon={ShieldCheck}
              label="الاحتفاظ بصور الطلب المكتمل"
              description="مدة معالجة ملاحظات الطباعة قبل حذف الأصل والمعاينة نهائياً."
              unit="يوم"
              min={1}
              max={180}
              value={operationRules.printOrderRetentionDays}
              onChange={(value) => updateOperationRule('printOrderRetentionDays', value)}
            />
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-[#E8B4BC]/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center justify-between gap-4 sm:justify-start">
              <button
                type="button"
                onClick={() => updateOperationRule('overdueTasksUrgent', !operationRules.overdueTasksUrgent)}
                className="text-[#E8B4BC]"
                aria-label="تبديل تصعيد المهام المتأخرة"
              >
                {operationRules.overdueTasksUrgent
                  ? <ToggleRight size={34} />
                  : <ToggleLeft size={34} className="text-[#171717]/35" />}
              </button>
              <span>
                <span className="block text-sm font-black">إظهار المهام المتجاوزة للمهلة كعاجلة</span>
                <span className="mt-1 block text-xs text-[#171717]/45">ينعكس مباشرة على عدّاد المهام العاجلة والتنبيه في الرئيسية.</span>
              </span>
            </label>
            <button
              type="submit"
              disabled={savingOperationRules}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 text-sm font-black text-white hover:bg-[#C6A56B] disabled:opacity-60"
            >
              {savingOperationRules ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              حفظ قواعد التشغيل
            </button>
          </div>
        </form>

        {/* 4. نظام المكافآت */}
        <form onSubmit={handleSaveRewardRules} className="md:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E8B4BC]/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-[#171717]">
                <Award size={20} className="text-[#C6A56B]" /> نظام المكافآت والنقاط
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#171717]/50">
                نقطتان لكل ريال مدفوع، وكل 100 نقطة تساوي ريالاً واحداً، وتنتهي كل دفعة نقاط بعد 4 أشهر.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-lg border px-3 py-2 text-xs font-black ${rewardRules.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-600'}`}>
                {rewardRules.enabled ? 'البرنامج مفعّل' : 'البرنامج متوقف'}
              </span>
              <button
                type="button"
                onClick={() => setRewardRules(DEFAULT_REWARD_RULES)}
                className="text-xs font-black text-[#171717]/55 hover:text-[#C6A56B]"
              >
                استعادة القيم الافتراضية
              </button>
            </div>
          </div>

          <div className="grid gap-x-8 lg:grid-cols-2">
            <OperationRuleField
              icon={Coins}
              label="معدل كسب النقاط"
              description="عدد النقاط التي يحصل عليها العميل مقابل كل ريال مؤهل ومدفوع فعلياً."
              unit="نقطة/ريال"
              min={0}
              max={100}
              step={0.1}
              value={rewardRules.pointsPerRiyal}
              onChange={(value) => updateRewardRule('pointsPerRiyal', value)}
            />
            <OperationRuleField
              icon={Calculator}
              label="قيمة النقطة"
              description="القيمة النقدية للنقطة عند استخدامها كخصم على طلب جديد."
              unit="ريال"
              min={0.0001}
              max={100}
              step={0.001}
              value={rewardRules.pointValue}
              onChange={(value) => updateRewardRule('pointValue', value)}
            />
            <OperationRuleField
              icon={Award}
              label="الحد الأدنى للاستبدال"
              description={`يبدأ الاستبدال من ${pointsToRewardValue(rewardRules.minimumRedemptionPoints, rewardRules).toFixed(2)} ريال.`}
              unit="نقطة"
              min={0}
              max={10000000}
              value={rewardRules.minimumRedemptionPoints}
              onChange={(value) => updateRewardRule('minimumRedemptionPoints', value)}
            />
            <OperationRuleField
              icon={Percent}
              label="أقصى استخدام في الطلب"
              description="النسبة القصوى من قيمة المنتجات التي يمكن سدادها بالنقاط."
              unit="%"
              min={0}
              max={100}
              step={0.1}
              value={rewardRules.maximumRedemptionPercent}
              onChange={(value) => updateRewardRule('maximumRedemptionPercent', value)}
            />
            <OperationRuleField
              icon={Clock3}
              label="صلاحية النقاط"
              description="تُحتسب المدة بشكل مستقل لكل دفعة نقاط من تاريخ اكتسابها."
              unit="شهر"
              min={1}
              max={60}
              value={rewardRules.expiryMonths}
              onChange={(value) => updateRewardRule('expiryMonths', value)}
            />
            <OperationRuleField
              icon={Award}
              label="مكافأة أول شراء"
              description="تُضاف بعد أول طلب مدفوع ومكتمل، وليس بمجرد إنشاء الحساب."
              unit="نقطة"
              min={0}
              max={1000000}
              value={rewardRules.signupBonusPoints}
              onChange={(value) => updateRewardRule('signupBonusPoints', value)}
            />
          </div>

          <div className="mt-5 grid gap-4 border-t border-[#E8B4BC]/15 pt-5 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-xl bg-[#FAF9F7] px-4 py-3">
              <span>
                <span className="block text-sm font-black">تشغيل برنامج المكافآت</span>
                <span className="mt-1 block text-xs text-[#171717]/50">يوقف الكسب والاستبدال الجديد مع إبقاء الأرصدة محفوظة.</span>
              </span>
              <button type="button" onClick={() => updateRewardRule('enabled', !rewardRules.enabled)} aria-label="تبديل برنامج المكافآت">
                {rewardRules.enabled
                  ? <ToggleRight size={34} className="text-[#E8B4BC]" />
                  : <ToggleLeft size={34} className="text-[#171717]/35" />}
              </button>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl bg-[#FAF9F7] px-4 py-3">
              <span>
                <span className="block text-sm font-black">مكافأة أول شراء</span>
                <span className="mt-1 block text-xs text-[#171717]/50">تمنع المكافأة الحسابات غير النشطة لأنها لا تُضاف قبل اكتمال الطلب.</span>
              </span>
              <button type="button" onClick={() => updateRewardRule('signupBonusEnabled', !rewardRules.signupBonusEnabled)} aria-label="تبديل مكافأة أول شراء">
                {rewardRules.signupBonusEnabled
                  ? <ToggleRight size={34} className="text-[#E8B4BC]" />
                  : <ToggleLeft size={34} className="text-[#171717]/35" />}
              </button>
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingRewardRules}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 text-sm font-black text-white hover:bg-[#C6A56B] disabled:opacity-60"
            >
              {savingRewardRules ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              حفظ نظام المكافآت
            </button>
          </div>
        </form>

        {/* 5. قسم أكواد الخصم */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <h3 className="font-bold text-[#171717] mb-6 flex items-center gap-2"><Tag className="text-[#E8B4BC]"/> أكواد الخصم</h3>
          
          <form onSubmit={handleAddCoupon} className="flex flex-col md:flex-row gap-4 mb-8 bg-[#FAF9F7] p-4 rounded-xl border border-[#E8B4BC]/15">
            <div className="flex-1">
              <label className="text-xs font-bold text-[#171717]/60 block mb-1">الكود</label>
              <input 
                type="text" 
                placeholder="مثلاً SALE20" 
                className="w-full border rounded-xl px-4 py-2 uppercase"
                value={newCoupon.code}
                onChange={e => setNewCoupon({...newCoupon, code: e.target.value})}
              />
            </div>
            <div className="w-full md:w-40">
              <label className="text-xs font-bold text-[#171717]/60 block mb-1">النوع</label>
              <select 
                className="w-full border rounded-xl px-4 py-2 bg-white"
                value={newCoupon.discount_type}
                onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})}
              >
                <option value="fixed">مبلغ ثابت (ريال)</option>
                <option value="percent">نسبة مئوية (%)</option>
              </select>
            </div>
            <div className="w-full md:w-32">
              <label className="text-xs font-bold text-[#171717]/60 block mb-1">القيمة</label>
              <input 
                type="number" 
                placeholder="0" 
                className="w-full border rounded-xl px-4 py-2 text-center font-bold"
                value={newCoupon.discount_amount}
                onChange={e => setNewCoupon({...newCoupon, discount_amount: e.target.value})}
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-[#E8B4BC]/100 hover:bg-gradient-to-b from-[#E8B4BC] to-[#C6A56B] text-white px-6 py-2 rounded-xl font-bold h-[42px] flex items-center gap-2 w-full md:w-auto justify-center">
                <Plus size={18}/> إضافة
              </button>
            </div>
          </form>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.length === 0 ? (
              <p className="col-span-full text-center text-[#171717]/50 py-4">لا توجد أكواد خصم حالياً</p>
            ) : (
              coupons.map(coupon => (
                <div key={coupon.id} className={`p-4 rounded-xl border flex justify-between items-center ${coupon.is_active ? 'bg-white border-[#E8B4BC]/20' : 'bg-[#FAF9F7] border-[#E8B4BC]/15 opacity-70'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#171717] text-lg">{coupon.code}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${coupon.is_active ? 'bg-[#E8B4BC]/15 text-[#E8B4BC]' : 'bg-[#E8B4BC]/10 text-[#171717]/60'}`}>
                        {coupon.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                    <div className="text-sm text-[#171717]/60 mt-1 flex items-center gap-1">
                      خصم: <span className="font-bold text-[#171717]/80">{coupon.discount_amount}</span>
                      {coupon.discount_type === 'percent' ? <Percent size={12}/> : <RiyalSign size="0.8em" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleCouponStatus(coupon.id, coupon.is_active)} className="text-[#171717]/50 hover:text-[#171717]/70">
                      {coupon.is_active ? <ToggleRight size={28} className="text-[#E8B4BC]"/> : <ToggleLeft size={28}/>}
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

        {/* 5. قوالب الرسائل */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-[#171717] flex items-center gap-2">
                <FileText className="text-[#C6A56B]" /> قوالب رسائل العملاء
              </h3>
              <p className="text-xs text-[#171717]/50 mt-1">
                قوالب موحدة للطلبات، الدفع، الشحن، الاسترجاع، الحساب، والحملات التسويقية.
              </p>
            </div>
            <button
              type="button"
              onClick={resetTemplateForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FAF9F7] border border-[#E8B4BC]/20 px-4 py-2 text-xs font-bold hover:bg-[#E8B4BC]/10 transition-colors"
            >
              <Plus size={15} /> قالب جديد
            </button>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6">
            <form onSubmit={saveTemplate} className="bg-[#FAF9F7] border border-[#E8B4BC]/15 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-black text-[#171717] flex items-center gap-2">
                  {editingTemplateId ? <Edit3 size={16} className="text-[#E8B4BC]" /> : <Plus size={16} className="text-[#E8B4BC]" />}
                  {editingTemplateId ? 'تعديل قالب' : 'إضافة قالب'}
                </h4>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={resetTemplateForm}
                    className="p-2 rounded-lg text-[#171717]/45 hover:text-red-500 hover:bg-white transition-colors"
                    title="إلغاء التحرير"
                  >
                    <XCircle size={17} />
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#171717]/60 mb-1">مفتاح القالب</label>
                  <input
                    value={templateForm.template_key}
                    onChange={(e) => setTemplateForm((current) => ({ ...current, template_key: normalizeTemplateKey(e.target.value) }))}
                    placeholder="payment_reminder"
                    dir="ltr"
                    className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-[#E8B4BC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717]/60 mb-1">اسم القالب</label>
                  <input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((current) => ({ ...current, name: e.target.value }))}
                    placeholder="تذكير بالدفع"
                    className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#E8B4BC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717]/60 mb-1">التصنيف</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm((current) => ({ ...current, category: e.target.value }))}
                    className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#E8B4BC]"
                  >
                    {templateCategories.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717]/60 mb-1">القناة</label>
                  <select
                    value={templateForm.channel}
                    onChange={(e) => setTemplateForm((current) => ({ ...current, channel: e.target.value }))}
                    className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#E8B4BC]"
                  >
                    {Object.entries(channelLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717]/60 mb-1">عنوان البريد</label>
                <input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((current) => ({ ...current, subject: e.target.value }))}
                  placeholder="تم تحديث طلبك #{order_number}"
                  className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#E8B4BC]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717]/60 mb-1">نص الرسالة</label>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm((current) => ({ ...current, body: e.target.value }))}
                  rows={8}
                  placeholder="مرحباً {customer_name}..."
                  className="w-full resize-none bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-3 text-sm font-bold leading-7 outline-none focus:border-[#E8B4BC]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717]/60 mb-1">المتغيرات</label>
                <input
                  value={templateForm.variablesText}
                  onChange={(e) => setTemplateForm((current) => ({ ...current, variablesText: e.target.value }))}
                  placeholder="customer_name, order_number, total_amount"
                  dir="ltr"
                  className="w-full bg-white border border-[#E8B4BC]/20 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-[#E8B4BC]"
                />
              </div>

              <label className="flex items-center justify-between gap-3 bg-white border border-[#E8B4BC]/15 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-[#171717]">القالب نشط</span>
                <button
                  type="button"
                  onClick={() => setTemplateForm((current) => ({ ...current, is_active: !current.is_active }))}
                  className="text-[#E8B4BC]"
                >
                  {templateForm.is_active ? <ToggleRight size={30} /> : <ToggleLeft size={30} className="text-[#171717]/40" />}
                </button>
              </label>

              <button
                type="submit"
                disabled={savingTemplate}
                className="w-full bg-[#171717] text-white py-3 rounded-xl font-bold hover:bg-[#333] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingTemplate ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                حفظ القالب
              </button>
            </form>

            <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1 custom-scrollbar">
              {messageTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E8B4BC]/25 bg-[#FAF9F7]/60 p-8 text-center">
                  <FileText size={30} className="mx-auto mb-3 text-[#E8B4BC]/50" />
                  <p className="text-sm font-bold text-[#171717]/55">لا توجد قوالب بعد. شغّل SQL الخاص بالقوالب أو أضف قالباً جديداً.</p>
                </div>
              ) : (
                messageTemplates.map((template) => {
                  const category = templateCategories.find((item) => item.value === template.category);
                  return (
                    <div key={template.id} className={`rounded-2xl border p-4 transition-colors ${template.is_active ? 'bg-white border-[#E8B4BC]/15' : 'bg-[#FAF9F7] border-[#E8B4BC]/10 opacity-75'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-[#171717]">{template.name}</h4>
                            <span className="px-2 py-0.5 rounded-lg bg-[#E8B4BC]/10 text-[#E8B4BC] text-[10px] font-black">
                              {category?.label || template.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-[#FAF9F7] text-[#171717]/55 text-[10px] font-black flex items-center gap-1">
                              <Mail size={10} /> {channelLabels[template.channel] || template.channel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-mono text-[#171717]/45 truncate" dir="ltr">{template.template_key}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => editTemplate(template)}
                            className="p-2 rounded-lg text-[#171717]/50 hover:text-[#E8B4BC] hover:bg-[#E8B4BC]/10 transition-colors"
                            title="تعديل"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => toggleTemplateStatus(template)}
                            className="p-1 rounded-lg text-[#E8B4BC] hover:bg-[#E8B4BC]/10 transition-colors"
                            title={template.is_active ? 'تعطيل' : 'تفعيل'}
                          >
                            {template.is_active ? <ToggleRight size={27} /> : <ToggleLeft size={27} className="text-[#171717]/35" />}
                          </button>
                          <button
                            onClick={() => deleteTemplate(template)}
                            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {template.subject && (
                        <p className="mt-3 text-sm font-bold text-[#171717] bg-[#FAF9F7] rounded-xl px-3 py-2">
                          {template.subject}
                        </p>
                      )}
                      <p className="mt-3 text-xs leading-6 text-[#171717]/65 whitespace-pre-line line-clamp-4">
                        {template.body}
                      </p>
                      {Array.isArray(template.variables) && template.variables.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {template.variables.map((variable) => (
                            <span key={variable} className="rounded-lg bg-[#C6A56B]/10 px-2 py-1 text-[10px] font-mono text-[#C6A56B]" dir="ltr">
                              {'{'}{variable}{'}'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

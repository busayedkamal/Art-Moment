import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle, Loader2, MessageCircle, Save, Send, ShieldCheck,
  ToggleLeft, ToggleRight, Wifi,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const DEFAULT_SETTINGS = {
  enabled: false,
  apiVersion: 'v26.0',
  phoneNumberId: '',
  wabaId: '',
  templateLanguage: 'ar',
  orderStatusTemplate: 'order_status_update',
  receiptTemplate: 'receipt_issued',
  verifiedName: '',
  displayPhoneNumber: '',
  qualityRating: '',
  lastTestedAt: '',
  lastTestStatus: '',
  accessTokenConfigured: false,
};

async function invokeWhatsApp(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke('whatsapp-api', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function WhatsAppSettingsCard() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [testPhone, setTestPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  useEffect(() => {
    let cancelled = false;
    invokeWhatsApp({ action: 'get_settings' })
      .then((data) => {
        if (!cancelled) setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
      })
      .catch((error) => {
        console.error('WhatsApp settings load failed:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setAction('save');
    try {
      const data = await invokeWhatsApp({ action: 'save_settings', settings });
      setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
      toast.success('تم حفظ إعدادات واتساب');
    } catch (error) {
      console.error(error);
      toast.error('تعذر حفظ إعدادات واتساب');
    } finally {
      setAction('');
    }
  };

  const testConnection = async () => {
    setAction('test');
    try {
      const data = await invokeWhatsApp({ action: 'test_connection' });
      setSettings((current) => ({
        ...current,
        lastTestStatus: 'connected',
        lastTestedAt: new Date().toISOString(),
        verifiedName: data?.connection?.verifiedName || current.verifiedName,
        displayPhoneNumber: data?.connection?.displayPhoneNumber || current.displayPhoneNumber,
        qualityRating: data?.connection?.qualityRating || current.qualityRating,
      }));
      toast.success('تم الاتصال بـ Meta بنجاح');
    } catch (error) {
      console.error(error);
      setSettings((current) => ({ ...current, lastTestStatus: 'failed' }));
      toast.error('فشل اختبار اتصال Meta');
    } finally {
      setAction('');
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('أدخل رقم الجوال المستلم للاختبار');
      return;
    }
    setAction('send');
    try {
      await invokeWhatsApp({ action: 'send_test', phone: testPhone.trim() });
      toast.success('تم إرسال رسالة واتساب التجريبية');
    } catch (error) {
      console.error(error);
      toast.error('تعذر إرسال الرسالة التجريبية');
    } finally {
      setAction('');
    }
  };

  const connected = settings.lastTestStatus === 'connected';

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-black text-[#171717]">
            <MessageCircle size={18} className="text-emerald-600" />
            WhatsApp Business Platform - Meta
          </h4>
          <p className="mt-1 text-[11px] text-[#171717]/55">إشعارات رسمية عبر Meta Cloud API والقوالب المعتمدة.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${connected ? 'text-emerald-700' : 'text-[#171717]/45'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-[#171717]/25'}`} />
            {connected ? 'متصل بـ Meta' : 'غير مختبر'}
          </span>
          <button type="button" onClick={() => update('enabled', !settings.enabled)} aria-label="تفعيل إشعارات واتساب">
            {settings.enabled
              ? <ToggleRight size={34} className="text-emerald-600" />
              : <ToggleLeft size={34} className="text-[#171717]/35" />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-bold text-[#171717]/65">
              Phone Number ID
              <input dir="ltr" value={settings.phoneNumberId} onChange={(event) => update('phoneNumberId', event.target.value)} className="mt-1 w-full border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500" placeholder="123456789012345" />
            </label>
            <label className="text-[11px] font-bold text-[#171717]/65">
              WhatsApp Business Account ID
              <input dir="ltr" value={settings.wabaId} onChange={(event) => update('wabaId', event.target.value)} className="mt-1 w-full border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500" placeholder="WABA ID" />
            </label>
            <label className="text-[11px] font-bold text-[#171717]/65">
              إصدار Meta Graph API
              <select dir="ltr" value={settings.apiVersion} onChange={(event) => update('apiVersion', event.target.value)} className="mt-1 w-full border bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500">
                <option value="v26.0">v26.0</option>
                <option value="v25.0">v25.0</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-[#171717]/65">
              لغة القالب
              <select value={settings.templateLanguage} onChange={(event) => update('templateLanguage', event.target.value)} className="mt-1 w-full border bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500">
                <option value="ar">العربية (ar)</option>
                <option value="ar_AR">العربية (ar_AR)</option>
                <option value="en_US">English (en_US)</option>
              </select>
            </label>
          </div>

          <label className="block text-[11px] font-bold text-[#171717]/65">
            قالب تحديث حالة الطلب
            <input dir="ltr" value={settings.orderStatusTemplate} onChange={(event) => update('orderStatusTemplate', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="mt-1 w-full border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500" placeholder="order_status_update" />
          </label>

          <label className="block text-[11px] font-bold text-[#171717]/65">
            قالب إرسال إيصال القبض
            <input dir="ltr" value={settings.receiptTemplate} onChange={(event) => update('receiptTemplate', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="mt-1 w-full border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500" placeholder="receipt_issued" />
          </label>

          <div className={`flex items-start gap-2 border p-3 text-xs ${settings.accessTokenConfigured ? 'border-emerald-200 bg-white text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <ShieldCheck size={17} className="mt-0.5 shrink-0" />
            <div>
              <strong>Meta Access Token: {settings.accessTokenConfigured ? 'محفوظ بأمان' : 'غير مضبوط'}</strong>
              <p className="mt-1 text-[10px] opacity-75">يُحفظ كسرّ Supabase باسم META_WHATSAPP_ACCESS_TOKEN ولا يُرسل إلى المتصفح.</p>
            </div>
          </div>

          {connected && (
            <div className="grid gap-2 bg-white p-3 text-[11px] sm:grid-cols-3">
              <span><b>الاسم:</b> {settings.verifiedName || '-'}</span>
              <span dir="ltr"><b>الرقم:</b> {settings.displayPhoneNumber || '-'}</span>
              <span><b>الجودة:</b> {settings.qualityRating || '-'}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={save} disabled={Boolean(action)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#171717] px-4 text-xs font-black text-white disabled:opacity-50">
              {action === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ الإعدادات
            </button>
            <button type="button" onClick={testConnection} disabled={Boolean(action)} className="inline-flex min-h-11 items-center justify-center gap-2 border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-700 disabled:opacity-50">
              {action === 'test' ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />} اختبار الاتصال
            </button>
          </div>

          <div className="grid gap-2 border-t border-emerald-200 pt-4 sm:grid-cols-[1fr_auto]">
            <input dir="ltr" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} className="border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" placeholder="05XXXXXXXX" />
            <button type="button" onClick={sendTest} disabled={Boolean(action)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">
              {action === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} إرسال رسالة تجريبية
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-[10px] text-emerald-700">
            <CheckCircle size={13} /> سيتم إرسال قالب WhatsApp رسمي تلقائيًا عند تغيير حالة الطلب.
          </p>
        </div>
      )}
    </section>
  );
}
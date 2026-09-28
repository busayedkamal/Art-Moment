import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Download, FileCheck2, Loader2, RefreshCw, Search, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import RiyalSign from '../components/RiyalSign';
import { RECEIPT_STATUS_META, downloadReceipt, invokeReceipt, receiptOrderLabel } from '../utils/receiptApi';

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setReceipts((await invokeReceipt({ action: 'list' })).receipts || []); }
    catch (error) { console.error(error); toast.error('تعذر تحميل الإيصالات'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => receipts.filter((receipt) => {
    if (status !== 'all' && receipt.status !== status) return false;
    const value = `${receipt.receipt_number} ${receipt.customer?.name || ''} ${receipt.customer?.phone || ''}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  }), [receipts, search, status]);
  const issued = receipts.filter((receipt) => receipt.status === 'issued');
  const total = issued.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

  const run = async (receipt, action) => {
    setBusyId(receipt.id);
    try {
      if (action === 'download') await downloadReceipt(receipt);
      if (action === 'resend') { await invokeReceipt({ action: 'resend', receiptId: receipt.id }); toast.success('تم إرسال الإيصال'); await load(); }
      if (action === 'cancel') {
        const reason = window.prompt(`سبب إلغاء الإيصال ${receipt.receipt_number}:`);
        if (!reason?.trim()) return;
        await invokeReceipt({ action: 'cancel', receiptId: receipt.id, reason });
        toast.success('تم إلغاء الإيصال'); await load();
      }
    } catch (error) { toast.error(error.message || 'تعذر تنفيذ العملية'); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-5 pb-16 text-[#171717]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-black"><FileCheck2 className="text-[#C6A56B]" /> إيصالات القبض</h1><p className="mt-1 text-sm text-[#5F5A57]">سجل المبالغ المستلمة نقدًا أو عبر التحويل المصرفي</p></div>
      <button onClick={load} className="grid size-11 place-items-center rounded-lg border bg-white" title="تحديث"><RefreshCw size={18} /></button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border bg-white p-4"><span className="text-xs text-[#5F5A57]">إجمالي المقبوضات الصادرة</span><strong className="mt-2 block text-2xl">{total.toFixed(2)} <RiyalSign size="0.7em" /></strong></div>
      <div className="rounded-lg border bg-white p-4"><span className="text-xs text-[#5F5A57]">الإيصالات الصادرة</span><strong className="mt-2 block text-2xl">{issued.length}</strong></div>
      <div className="rounded-lg border bg-white p-4"><span className="text-xs text-[#5F5A57]">الإيصالات الملغاة</span><strong className="mt-2 block text-2xl text-red-600">{receipts.filter((receipt) => receipt.status === 'cancelled').length}</strong></div>
    </div>
    <div className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-[1fr_180px]">
      <label className="relative"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F5A57]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم الإيصال أو العميل أو الجوال" className="h-11 w-full rounded-lg border pr-10 pl-3 outline-none focus:border-[#C6A56B]" /></label>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border bg-white px-3 outline-none"><option value="all">كل الحالات</option><option value="issued">صادر</option><option value="cancelled">ملغي</option><option value="draft">مسودة</option></select>
    </div>
    <div className="overflow-hidden rounded-lg border bg-white">
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#C6A56B]" /></div> : filtered.length === 0 ? <div className="py-16 text-center text-sm font-bold text-[#5F5A57]">لا توجد إيصالات مطابقة.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-[#FAF9F7] text-xs text-[#5F5A57]"><tr><th className="p-4">رقم الإيصال</th><th className="p-4">العميل</th><th className="p-4">المبلغ</th><th className="p-4">الطريقة</th><th className="p-4">الطلب</th><th className="p-4">الحالة</th><th className="p-4">واتساب</th><th className="p-4">الإجراءات</th></tr></thead><tbody>{filtered.map((receipt) => { const meta = RECEIPT_STATUS_META[receipt.status] || RECEIPT_STATUS_META.draft; return <tr key={receipt.id} className="border-t"><td className="p-4 font-black" dir="ltr">{receipt.receipt_number}</td><td className="p-4"><strong className="block">{receipt.customer?.name || '—'}</strong><span className="text-xs text-[#5F5A57]" dir="ltr">{receipt.customer?.phone || ''}</span></td><td className="p-4 font-black">{Number(receipt.amount).toFixed(2)} <RiyalSign size=".8em" /></td><td className="p-4">{receipt.payment_method === 'bank_transfer' ? 'تحويل مصرفي' : 'نقدًا'}</td><td className="p-4 text-xs">{receiptOrderLabel(receipt)}</td><td className="p-4"><span className={`rounded px-2 py-1 text-[11px] font-black ${meta.className}`}>{meta.label}</span></td><td className="p-4 text-xs">{receipt.whatsapp_status === 'sent' ? 'تم الإرسال' : receipt.whatsapp_status === 'failed' ? 'تعذر الإرسال' : 'لم يرسل'}</td><td className="p-4"><div className="flex gap-1.5">{receipt.status !== 'draft' && <button onClick={() => run(receipt, 'download')} disabled={busyId === receipt.id} className="grid size-9 place-items-center rounded-lg border" title="تنزيل"><Download size={15} /></button>}{receipt.status === 'issued' && <button onClick={() => run(receipt, 'resend')} disabled={busyId === receipt.id} className="grid size-9 place-items-center rounded-lg border text-emerald-600" title="إرسال واتساب"><Send size={15} /></button>}{receipt.status === 'issued' && <button onClick={() => run(receipt, 'cancel')} disabled={busyId === receipt.id} className="grid size-9 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600" title="إلغاء"><Ban size={15} /></button>}</div></td></tr>; })}</tbody></table></div>}
    </div>
  </div>;
}
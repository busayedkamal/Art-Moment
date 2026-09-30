import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import RiyalSign from '../components/RiyalSign';
import { supabase } from '../lib/supabase';

export default function ReceiptVerificationPage() {
  const { receiptNumber, token } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: false });
  useEffect(() => {
    let active = true;
    supabase.functions.invoke('receipt-public-api', { body: { receiptNumber, verificationToken: token } })
      .then(({ data, error }) => { if (active) setState({ loading: false, data: error ? null : data, error: Boolean(error) || !data?.valid }); })
      .catch(() => { if (active) setState({ loading: false, data: null, error: true }); });
    return () => { active = false; };
  }, [receiptNumber, token]);
  const receipt = state.data?.receipt;
  const cancelled = receipt?.status === 'cancelled';
  return <main className="min-h-screen bg-[#FAF9F7] px-4 py-12 text-[#171717]" dir="rtl"><SeoHead title="التحقق من إيصال قبض | لحظة فن" description="التحقق من صحة إيصال قبض صادر من لحظة فن." noindex nofollow /><div className="mx-auto max-w-xl rounded-lg border border-[#E8B4BC]/25 bg-white p-6 shadow-sm sm:p-9"><div className="mb-7 text-center"><FileCheck2 size={42} className="mx-auto text-[#C6A56B]" /><h1 className="mt-3 text-2xl font-black">التحقق من إيصال القبض</h1></div>{state.loading ? <div className="flex justify-center py-14"><Loader2 className="animate-spin text-[#C6A56B]" /></div> : state.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"><XCircle size={38} className="mx-auto text-red-600" /><h2 className="mt-3 text-xl font-black text-red-700">تعذر التحقق من الإيصال</h2><p className="mt-2 text-sm text-red-600">الرابط غير صحيح أو لا يطابق إيصالًا صادرًا من Art Moment.</p></div> : <><div className={`rounded-lg border p-5 text-center ${cancelled ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>{cancelled ? <AlertTriangle size={40} className="mx-auto text-red-600" /> : <CheckCircle2 size={40} className="mx-auto text-emerald-600" />}<h2 className={`mt-3 text-xl font-black ${cancelled ? 'text-red-700' : 'text-emerald-700'}`}>{cancelled ? 'هذا الإيصال ملغي' : 'إيصال صحيح'}</h2></div><dl className="mt-6 divide-y rounded-lg border"><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">رقم الإيصال</dt><dd className="font-black" dir="ltr">{receipt.receiptNumber}</dd></div><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">رمز التحقق</dt><dd className="font-black" dir="ltr">{receipt.verificationCode}</dd></div><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">العميل</dt><dd className="font-black">{receipt.customerName}</dd></div><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">المبلغ</dt><dd className="font-black">{Number(receipt.amount).toFixed(2)} <RiyalSign size=".8em" /></dd></div><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">طريقة الاستلام</dt><dd className="font-black">{receipt.paymentMethod === 'bank_transfer' ? 'تحويل مصرفي' : 'نقدًا'}</dd></div><div className="flex justify-between gap-4 p-4"><dt className="text-sm text-[#5F5A57]">التاريخ</dt><dd className="font-black" dir="ltr">{new Date(`${receipt.paymentDate}T12:00:00`).toLocaleDateString('en-GB')}</dd></div></dl><p className="mt-5 text-center text-xs leading-6 text-[#5F5A57]">هذه الصفحة تعرض بيانات محدودة للتحقق فقط، ولا تعرض رقم الجوال أو مرجع التحويل أو الملاحظات الداخلية.</p></>}</div></main>;
}
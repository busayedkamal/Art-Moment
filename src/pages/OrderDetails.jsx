// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ArrowRight, Printer, CheckCircle, Truck, Trash2, 
  Banknote, Calendar, Phone, FileText 
} from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب البيانات
  useEffect(() => {
    async function fetchOrder() {
      try {
        const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
        if (error) throw error;
        setOrder(data);
      } catch (err) {
        toast.error('لم يتم العثور على الطلب');
        navigate('/app/orders');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id, navigate]);

  // دالة الطباعة (الحل الجذري: نافذة منبثقة)
  const handlePrint = () => {
    // 1. إنشاء نافذة جديدة فارغة
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة');
      return;
    }

    // 2. تصميم الفاتورة (HTML + CSS)
    const invoiceContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>فاتورة طلب #${order.id.slice(0, 6)}</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 20px; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 900; }
          .info-box { display: flex; justify-content: space-between; border: 1px solid #ddd; padding: 10px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: right; border-bottom: 2px solid #000; padding: 5px; }
          td { padding: 8px 5px; border-bottom: 1px solid #eee; }
          .totals { border-top: 2px solid #000; padding-top: 10px; }
          .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          @media print {
            @page { size: A5; margin: 0; }
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Art Moment</h1>
          <p>للطباعة الفوتوغرافية</p>
        </div>

        <div class="info-box">
          <div style="text-align: right;">
            <strong>العميل:</strong> ${order.customer_name}<br>
            <span dir="ltr">${order.phone}</span>
          </div>
          <div style="text-align: left;">
            <strong>رقم الفاتورة:</strong> #${order.id.slice(0, 6)}<br>
            ${new Date().toLocaleDateString('en-GB')}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الوصف</th>
              <th style="text-align: center;">الكمية</th>
              <th style="text-align: left;">السعر</th>
            </tr>
          </thead>
          <tbody>
            ${order.a4_qty > 0 ? `
            <tr>
              <td>طباعة صور A4</td>
              <td style="text-align: center;">${order.a4_qty}</td>
              <td style="text-align: left;">-</td>
            </tr>` : ''}
            
            ${order.photo_4x6_qty > 0 ? `
            <tr>
              <td>طباعة صور 4×6</td>
              <td style="text-align: center;">${order.photo_4x6_qty}</td>
              <td style="text-align: left;">-</td>
            </tr>` : ''}

            ${order.delivery_fee > 0 ? `
            <tr>
              <td>رسوم التوصيل</td>
              <td style="text-align: center;">-</td>
              <td style="text-align: left;">${order.delivery_fee}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>الإجمالي</span>
            <span>${order.total_amount} ر.س</span>
          </div>
          ${order.deposit > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #666; font-size: 14px; margin-bottom: 10px;">
            <span>المدفوع</span>
            <span>${order.deposit} ر.س</span>
          </div>` : ''}
          
          <div style="display: flex; justify-content: space-between; background: #f0f0f0; padding: 10px; border-radius: 5px; font-weight: bold;">
            <span>المتبقي</span>
            <span>${(order.total_amount - order.deposit).toFixed(2)} ر.س</span>
          </div>
        </div>

        <div class="footer">
          <p>شكراً لاختياركم Art Moment</p>
          <p>الأحساء | خدمة العملاء</p>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;

    // 3. كتابة المحتوى في النافذة وتشغيل الطباعة
    printWindow.document.write(invoiceContent);
    printWindow.document.close();
  };

  // دوال التحديث والحذف (بقيت كما هي)
  const updateStatus = async (newStatus) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      setOrder({ ...order, status: newStatus });
      toast.success('تم تحديث الحالة');
    } catch (err) { toast.error('فشل التحديث'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('حذف نهائي؟')) return;
    try {
      await supabase.from('orders').delete().eq('id', id);
      navigate('/app/orders');
    } catch (err) { toast.error('فشل الحذف'); }
  };

  const getStatusText = (s) => {
    const map = { new: 'جديد', printing: 'طباعة', done: 'جاهز', delivered: 'تم التسليم' };
    return map[s] || s;
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/orders')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <ArrowRight size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              طلب: {order.customer_name}
              <span className={`text-sm font-normal px-3 py-1 rounded-full border ${
                order.status === 'done' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {getStatusText(order.status)}
              </span>
            </h1>
            <p className="text-sm text-slate-500 font-mono mt-1">#{order.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200">
            <FileText size={18} /> طباعة فاتورة A5
          </button>

          {order.status === 'new' && (
            <button onClick={() => updateStatus('printing')} className="btn-action bg-blue-600 text-white px-4 py-2 rounded-xl">بدء الطباعة</button>
          )}
          {order.status === 'printing' && (
            <button onClick={() => updateStatus('done')} className="btn-action bg-emerald-600 text-white px-4 py-2 rounded-xl">تم الانتهاء</button>
          )}
          {order.status === 'done' && (
            <button onClick={() => updateStatus('delivered')} className="btn-action bg-slate-800 text-white px-4 py-2 rounded-xl">تسليم للعميل</button>
          )}
          <button onClick={handleDelete} className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Trash2 size={18} /></button>
        </div>
      </div>

      {/* باقي تفاصيل الصفحة (لم تتغير) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="font-bold mb-4">بيانات العميل</h3>
          <p>الجوال: <span dir="ltr">{order.phone}</span></p>
          <p>التسليم: {order.delivery_date}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
           <h3 className="font-bold mb-4">الملخص</h3>
           <p className="text-xl font-bold">{order.total_amount} ر.س</p>
        </div>
      </div>
    </div>
  );
}
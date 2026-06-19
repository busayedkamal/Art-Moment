// src/pages/StoreOrdersManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye, Clock, CheckCircle, Package, Truck, X,
  ArrowLeft, RotateCcw, Printer, FileText, AlertCircle,
  ShoppingBag, Phone, User, StickyNote, Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

// ─── FSM Configuration ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending_verification: {
    label: 'انتظار التحقق',
    bgClass: 'bg-blue-100',    textClass: 'text-blue-700',
    btnClass: 'bg-blue-600 hover:bg-blue-500 text-white',
    icon: Clock,
  },
  confirmed: {
    label: 'مؤكد',
    bgClass: 'bg-indigo-100',  textClass: 'text-indigo-700',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    icon: CheckCircle,
  },
  processing: {
    label: 'قيد الإنتاج',
    bgClass: 'bg-amber-100',   textClass: 'text-amber-700',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-white',
    icon: Printer,
  },
  ready_for_delivery: {
    label: 'جاهز للتسليم',
    bgClass: 'bg-teal-100',    textClass: 'text-teal-700',
    btnClass: 'bg-teal-600 hover:bg-teal-500 text-white',
    icon: Package,
  },
  shipped: {
    label: 'تم الشحن',
    bgClass: 'bg-cyan-100',    textClass: 'text-cyan-700',
    btnClass: 'bg-cyan-600 hover:bg-cyan-500 text-white',
    icon: Truck,
  },
  delivered: {
    label: 'تم الاستلام',
    bgClass: 'bg-emerald-100', textClass: 'text-emerald-700',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'ملغي',
    bgClass: 'bg-red-100',     textClass: 'text-red-700',
    btnClass: 'bg-red-600 hover:bg-red-500 text-white',
    icon: X,
  },
  returned: {
    label: 'مرتجع',
    bgClass: 'bg-orange-100',  textClass: 'text-orange-700',
    btnClass: 'bg-orange-500 hover:bg-orange-400 text-white',
    icon: RotateCcw,
  },
};

const VALID_TRANSITIONS = {
  pending_verification: ['confirmed', 'cancelled'],
  confirmed:            ['processing', 'cancelled'],
  processing:           ['ready_for_delivery', 'cancelled'],
  ready_for_delivery:   ['shipped', 'delivered', 'cancelled'],
  shipped:              ['delivered', 'returned'],
  delivered:            ['returned'],
  cancelled:            ['confirmed'],
  returned:             [],
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bgClass: 'bg-gray-100', textClass: 'text-gray-600' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-transparent ${cfg.bgClass} ${cfg.textClass}`}>
      {Icon && <Icon size={11} />} {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StoreOrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('سمسا');

  // ── Fetch orders list ──────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      toast.error('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Fetch items when a modal opens ────────────────────────────────────────

  const openModal = async (order) => {
    setSelectedOrder(order);
    setOrderItems([]);
    setItemsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_order_items')
        .select('*, product:products(name, image)')
        .eq('store_order_id', order.id);
      if (error) throw error;
      setOrderItems(data || []);
    } catch (err) {
      console.error(err);
      toast.error('فشل تحميل منتجات الطلب');
    } finally {
      setItemsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setTrackingNumber('');
    setCourierName('سمسا');
  };

  // ── WhatsApp tracking notification ────────────────────────────────────────

  const sendTrackingWhatsApp = async (order, tracking, courier) => {
    try {
      const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (!settings || !settings.whatsapp_enabled || !settings.whatsapp_instance_id || !settings.whatsapp_token) return;

      let formattedPhone = String(order.phone).replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '966' + formattedPhone.substring(1);

      const trackingUrl = courier === 'سمسا'
        ? `https://www.smsaexpress.com/sa/ar/trackingdetails?tracknumbers=${tracking}`
        : courier === 'أرامكس'
        ? `https://www.aramex.com/sa/ar/track/results?mode=0&ShipmentNumber=${tracking}`
        : null;

      const msg =
        `مرحباً *${order.customer_name}* 📦\n\n` +
        `تم شحن طلبك رقم *#${String(order.id).slice(0, 8)}* بنجاح!\n\n` +
        `شركة الشحن: *${courier}*\n` +
        `رقم التتبع: *${tracking}*\n` +
        (trackingUrl ? `\nيمكنك تتبع مسار شحنتك لحظة بلحظة عبر الرابط التالي:\n${trackingUrl}\n` : '') +
        `\nنسعد بخدمتكم في لحظة فن ✨`;

      await fetch(`https://api.ultramsg.com/${settings.whatsapp_instance_id}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.whatsapp_token, to: formattedPhone, body: msg })
      });
    } catch (error) {
      console.error('Tracking WhatsApp Error:', error);
    }
  };

  // ── FSM status update ──────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus) => {
    if (!selectedOrder || statusUpdating) return;

    if (newStatus === 'shipped' && !selectedOrder.tracking_number && !trackingNumber.trim()) {
      toast.error('يرجى إدخال رقم التتبع قبل تحويل الحالة إلى "تم الشحن"');
      return;
    }

    setStatusUpdating(true);
    const toastId = toast.loading('جاري تحديث الحالة...');
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === 'shipped' && trackingNumber.trim()) {
        updatePayload.tracking_number = trackingNumber.trim();
        updatePayload.courier_name = courierName;
      }

      const { error } = await supabase
        .from('store_orders')
        .update(updatePayload)
        .eq('id', selectedOrder.id);
      if (error) throw error;

      const updated = { ...selectedOrder, ...updatePayload };
      setSelectedOrder(updated);
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));

      if (newStatus === 'shipped' && trackingNumber.trim()) {
        await sendTrackingWhatsApp(updated, trackingNumber.trim(), courierName);
      }

      toast.success(`تم تغيير الحالة إلى: ${STATUS_CONFIG[newStatus]?.label || newStatus}`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('فشل تحديث الحالة', { id: toastId });
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="text-[#4A4A4A]" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <ShoppingBag size={22} className="text-[#D9A3AA]" /> طلبات المتجر
          </h1>
          <p className="text-sm text-[#4A4A4A]/50 mt-0.5">إدارة الطلبات الواردة من متجر لحظة فن</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 bg-white border border-[#D9A3AA]/25 px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#D9A3AA]/5 transition-colors shadow-sm"
        >
          <RefreshCw size={15} /> تحديث
        </button>
      </div>

      {/* ── Status Filter Chips ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
            filterStatus === 'all'
              ? 'bg-[#4A4A4A] text-white border-[#4A4A4A]'
              : 'bg-white text-[#4A4A4A]/60 border-[#D9A3AA]/20 hover:border-[#D9A3AA]'
          }`}
        >
          الكل ({orders.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                filterStatus === key
                  ? `${cfg.bgClass} ${cfg.textClass} border-current`
                  : 'bg-white text-[#4A4A4A]/60 border-[#D9A3AA]/20 hover:border-[#D9A3AA]'
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Orders Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#4A4A4A]/40">
          <div className="w-8 h-8 border-4 border-[#D9A3AA]/30 border-t-[#D9A3AA] rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#4A4A4A]/40">
          <ShoppingBag size={40} className="mb-3 opacity-30" />
          <p className="font-bold">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F5F2] border-b border-[#D9A3AA]/15">
                  <th className="text-right py-3 px-5 font-bold text-[#4A4A4A]/60 text-xs">رقم الطلب</th>
                  <th className="text-right py-3 px-4 font-bold text-[#4A4A4A]/60 text-xs">العميل</th>
                  <th className="text-right py-3 px-4 font-bold text-[#4A4A4A]/60 text-xs">الجوال</th>
                  <th className="text-right py-3 px-4 font-bold text-[#4A4A4A]/60 text-xs">الإجمالي</th>
                  <th className="text-right py-3 px-4 font-bold text-[#4A4A4A]/60 text-xs">التاريخ</th>
                  <th className="text-right py-3 px-4 font-bold text-[#4A4A4A]/60 text-xs">الحالة</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F5F2]">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-[#F8F5F2]/60 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs text-[#4A4A4A]/50">
                      #{order.id.toString().slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 font-bold">{order.customer_name}</td>
                    <td className="py-3.5 px-4 font-mono text-sm text-[#4A4A4A]/70">{order.phone}</td>
                    <td className="py-3.5 px-4 font-black text-[#C5A059]">
                      {Number(order.total_amount || 0).toFixed(2)} <span className="text-[10px] font-normal">ر.س</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#4A4A4A]/50 font-mono">
                      {new Date(order.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => openModal(order)}
                        className="flex items-center gap-1.5 bg-[#4A4A4A]/5 hover:bg-[#D9A3AA]/15 text-[#4A4A4A] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Eye size={13} /> تفاصيل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[#F8F5F2]">
            {filteredOrders.map(order => (
              <div key={order.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-sm truncate">{order.customer_name}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="font-mono text-xs text-[#4A4A4A]/50">{order.phone}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-black text-[#C5A059] text-sm">
                      {Number(order.total_amount || 0).toFixed(2)} ر.س
                    </span>
                    <span className="text-[10px] text-[#4A4A4A]/40 font-mono">
                      {new Date(order.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openModal(order)}
                  className="p-2.5 bg-[#F8F5F2] rounded-xl hover:bg-[#D9A3AA]/15 transition-colors shrink-0"
                >
                  <Eye size={16} className="text-[#4A4A4A]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Order Details Modal ── */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9A3AA]/15 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={closeModal} className="p-2 hover:bg-[#F8F5F2] rounded-xl transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="font-black text-base">تفاصيل الطلب</h2>
                  <p className="text-xs font-mono text-[#4A4A4A]/40">#{selectedOrder.id.toString().slice(0, 8)}</p>
                </div>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <div className="p-6 space-y-6">

                {/* ── Customer Info ── */}
                <div className="bg-[#F8F5F2] rounded-2xl p-4 space-y-3">
                  <h3 className="font-bold text-sm text-[#4A4A4A]/60 mb-2 flex items-center gap-1.5">
                    <User size={14} /> بيانات العميل
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-0.5">الاسم</span>
                      <span className="font-bold text-sm">{selectedOrder.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-0.5 flex items-center gap-1">
                        <Phone size={10} /> الجوال
                      </span>
                      <span className="font-mono text-sm">{selectedOrder.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-0.5">الإجمالي</span>
                      <span className="font-black text-[#C5A059]">
                        {Number(selectedOrder.total_amount || 0).toFixed(2)} ر.س
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-0.5">تاريخ الطلب</span>
                      <span className="font-mono text-xs">
                        {new Date(selectedOrder.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>
                  {(selectedOrder.city || selectedOrder.district || selectedOrder.street) && (
                    <div className="pt-3 mt-1 border-t border-[#D9A3AA]/15">
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-1 flex items-center gap-1">
                        <Truck size={10} /> عنوان التوصيل
                      </span>
                      <p className="text-sm font-bold text-[#4A4A4A]">
                        {selectedOrder.city} — حي {selectedOrder.district}
                        {selectedOrder.street && (
                          <span className="text-[#4A4A4A]/70 font-normal">، {selectedOrder.street}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div className="pt-3 border-t border-[#D9A3AA]/15">
                      <span className="text-[10px] text-[#4A4A4A]/50 block mb-1 flex items-center gap-1">
                        <StickyNote size={10} /> ملاحظات
                      </span>
                      <p className="text-sm text-[#4A4A4A]/80 leading-relaxed">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* ── Shipping & Tracking ── */}
                <div className="bg-[#F8F5F2] rounded-2xl p-4">
                  <h3 className="font-bold text-sm text-[#4A4A4A]/60 mb-3 flex items-center gap-1.5">
                    <Truck size={14} className="text-[#D9A3AA]" /> معلومات الشحن والتتبع
                  </h3>
                  {selectedOrder.tracking_number ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#D9A3AA]/20">
                      <div>
                        <p className="text-[10px] text-[#4A4A4A]/50 mb-0.5">شركة الشحن</p>
                        <p className="font-bold text-sm">{selectedOrder.courier_name}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-[#4A4A4A]/50 mb-0.5">رقم التتبع</p>
                        <p className="font-mono font-bold text-[#D9A3AA]">{selectedOrder.tracking_number}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                      <div className="w-full sm:w-36">
                        <label className="text-[10px] text-[#4A4A4A]/50 block mb-1">شركة الشحن</label>
                        <select
                          value={courierName}
                          onChange={e => setCourierName(e.target.value)}
                          className="w-full bg-white border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D9A3AA]"
                        >
                          <option value="سمسا">سمسا (SMSA)</option>
                          <option value="أرامكس">أرامكس (Aramex)</option>
                          <option value="ساعي">مندوب خاص</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[#4A4A4A]/50 block mb-1">رقم التتبع</label>
                        <input
                          type="text"
                          value={trackingNumber}
                          onChange={e => setTrackingNumber(e.target.value)}
                          placeholder="أدخل رقم البوليصة..."
                          className="w-full bg-white border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none font-mono focus:border-[#D9A3AA]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Order Items ── */}
                <div>
                  <h3 className="font-bold text-sm text-[#4A4A4A]/60 mb-3 flex items-center gap-1.5">
                    <Package size={14} /> المنتجات
                  </h3>
                  {itemsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-4 border-[#D9A3AA]/30 border-t-[#D9A3AA] rounded-full animate-spin" />
                    </div>
                  ) : orderItems.length === 0 ? (
                    <p className="text-sm text-[#4A4A4A]/40 text-center py-6">لا توجد منتجات مسجلة</p>
                  ) : (
                    <div className="space-y-3">
                      {orderItems.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center gap-3 bg-[#F8F5F2] rounded-2xl p-3">
                          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden border border-[#D9A3AA]/15">
                            {item.product?.image
                              ? <img src={item.product.image} alt={item.product?.name} className="w-full h-full object-cover" />
                              : <ImageIcon size={18} className="text-[#D9A3AA]/30" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{item.product?.name || 'منتج محذوف'}</p>
                            <p className="text-xs text-[#4A4A4A]/50 mt-0.5">
                              {item.price_at_time} ر.س × {item.quantity}
                            </p>
                          </div>
                          <span className="font-black text-[#C5A059] text-sm shrink-0">
                            {(item.price_at_time * item.quantity).toFixed(2)} ر.س
                          </span>
                        </div>
                      ))}
                      {/* Total row */}
                      <div className="flex justify-between items-center pt-2 border-t border-[#D9A3AA]/15 px-1">
                        <span className="text-sm font-bold text-[#4A4A4A]/60">الإجمالي</span>
                        <span className="font-black text-[#C5A059]">
                          {Number(selectedOrder.total_amount || 0).toFixed(2)} ر.س
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── FSM Action Buttons ── */}
                <div className="bg-[#F8F5F2] rounded-2xl p-4">
                  <h3 className="font-bold text-sm text-[#4A4A4A]/60 mb-3 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-[#D9A3AA]" /> تغيير الحالة
                  </h3>
                  {(VALID_TRANSITIONS[selectedOrder.status] || []).length === 0 ? (
                    <p className="text-xs text-[#4A4A4A]/40 text-center py-2">
                      لا توجد انتقالات متاحة لهذه الحالة
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(VALID_TRANSITIONS[selectedOrder.status] || []).map(nextStatus => {
                        const cfg = STATUS_CONFIG[nextStatus] || { label: nextStatus, btnClass: 'bg-gray-500 text-white' };
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={nextStatus}
                            onClick={() => handleStatusChange(nextStatus)}
                            disabled={statusUpdating}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 shadow-sm disabled:opacity-50 disabled:pointer-events-none ${cfg.btnClass}`}
                          >
                            {Icon && <Icon size={14} />} {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#D9A3AA]/15 shrink-0">
              <button
                onClick={closeModal}
                className="w-full py-2.5 rounded-xl bg-[#F8F5F2] text-[#4A4A4A] font-bold text-sm hover:bg-[#D9A3AA]/10 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

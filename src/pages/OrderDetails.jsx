// src/pages/OrderDetails.jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { getOrderById, updateOrder } from '../storage/orderStorage.js'
import { loadSettings } from '../storage/settingsStorage.js'
import { getReadinessInfo } from '../utils/readinessHelpers.js'
import logoArtMoment from '../assets/logo-art-moment.svg'

const SOURCE_OPTIONS = ['واتساب', 'تيليغرام', 'إنستقرام', 'ايميل', 'مباشر']

// قوالب افتراضية احتياطية في حال ما وُجدت في الإعدادات لأي سبب
const FALLBACK_NOTE_TEMPLATES = [
  'تم استلام العربون.',
  'بانتظار صور إضافية من العميل.',
  'جاهز للاستلام – تم التواصل مع العميل.',
  'تم التسليم – بانتظار تقييمك لنا 🌟.',
]

export default function OrderDetails() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  const originalOrder = getOrderById(orderId)

  // إعدادات من صفحة الإعدادات (أسعار + قوالب ملاحظات)
  const settings = loadSettings()
  const price4x6 = Number(settings.price4x6 ?? 0)
  const priceA4 = Number(settings.priceA4 ?? 0)
  const hasPricing = price4x6 > 0 || priceA4 > 0

  const noteTemplates =
    Array.isArray(settings.noteTemplates) && settings.noteTemplates.length
      ? settings.noteTemplates
      : FALLBACK_NOTE_TEMPLATES

  const [order, setOrder] = useState(() => {
    if (!originalOrder) return null
    return {
      ...originalOrder,
      photos4x6: originalOrder.photos4x6 ?? 0,
      photosA4: originalOrder.photosA4 ?? 0,
      totalAmount: originalOrder.totalAmount ?? 0,
      paidAmount: originalOrder.paidAmount ?? 0,
      notes: originalOrder.notes || '',
      paymentMethod: originalOrder.paymentMethod || 'cash',

      // الوسوم الجديدة
      urgency: originalOrder.urgency || 'عادي',
      orderType: originalOrder.orderType || '',

      onlinePaymentStatus: originalOrder.onlinePaymentStatus ?? null,
      onlinePaymentId: originalOrder.onlinePaymentId ?? null,
      onlinePaymentProvider: originalOrder.onlinePaymentProvider ?? null,
      onlinePaymentUrl: originalOrder.onlinePaymentUrl ?? null,
      onlinePaymentCreatedAt: originalOrder.onlinePaymentCreatedAt ?? null,
      onlinePaymentPaidAt: originalOrder.onlinePaymentPaidAt ?? null,
    }
  })

  // حالة واجهة مصادر الطلب (منفصلة عن order.source)
  const initialSourceUI = parseSourceForUI(originalOrder?.source)
  const [selectedSources, setSelectedSources] = useState(
    initialSourceUI.selected,
  )
  const [otherSource, setOtherSource] = useState(initialSourceUI.other)

  // إظهار/إخفاء قائمة الملاحظات الجاهزة
  const [showTemplates, setShowTemplates] = useState(false)

  if (!order) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          تفاصيل الطلب
        </h1>
        <p className="text-sm text-red-600">
          لم يتم العثور على الطلب المطلوب.
        </p>
        <button
          onClick={() => navigate('/app/orders')}
          className="btn-secondary"
        >
          الرجوع إلى صفحة الطلبات
        </button>
      </div>
    )
  }

  const remaining = (order.totalAmount || 0) - (order.paidAmount || 0)
  const readiness = getReadinessInfo(order)

  // تحديث عام للطلب + حفظ في localStorage
  const syncAndSetOrder = (updater) => {
    setOrder((prev) => {
      if (!prev) return prev
      const next = typeof updater === 'function' ? updater(prev) : updater
      updateOrder(next)
      return next
    })
  }

  const handleFieldChange = (e) => {
    const { name, value } = e.target

    syncAndSetOrder((prev) => {
      let next = { ...prev }

      if (name === 'photos4x6' || name === 'photosA4') {
        next[name] = Number(value || 0)
      } else if (name === 'totalAmount' || name === 'paidAmount') {
        next[name] = Number(value || 0)
        const total =
          name === 'totalAmount' ? Number(value || 0) : next.totalAmount
        const paid =
          name === 'paidAmount' ? Number(value || 0) : next.paidAmount
        next.paymentStatus = getPaymentStatus(total, paid)
      } else if (name === 'notes') {
        next.notes = value
      } else if (name === 'customerName' || name === 'phone') {
        next[name] = value
      }

      return next
    })
  }

  // تغيير الوسوم (الأولوية / نوع الطلب)
  const handleTagChange = (field, value) => {
    syncAndSetOrder((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // checkboxes لمصدر الطلب – يتم حفظها عند الضغط على "حفظ التعديلات"
  const handleToggleSource = (option) => {
    setSelectedSources((prev) => {
      if (prev.includes(option)) {
        return prev.filter((v) => v !== option)
      }
      return [...prev, option]
    })
  }

  const handleOtherSourceChange = (e) => {
    setOtherSource(e.target.value)
  }

  const handlePaymentMethodChange = (e) => {
    const value = e.target.value
    syncAndSetOrder((prev) => ({
      ...prev,
      paymentMethod: value,
    }))
  }

  const handleChangeStatus = (newStatus) => {
    syncAndSetOrder((prev) => ({
      ...prev,
      status: newStatus,
    }))
  }

  const handleMarkDelivered = () => {
    syncAndSetOrder((prev) => ({
      ...prev,
      status: 'تم التسليم',
      paymentStatus: getPaymentStatus(prev.totalAmount, prev.paidAmount),
    }))
  }

  // 🔢 زر الحاسبة التلقائية داخل صفحة التفاصيل
  const handleAutoRecalculateTotal = () => {
    if (!hasPricing) {
      alert('لم يتم ضبط أسعار الصور بعد. يمكنك تعيينها من صفحة الإعدادات.')
      return
    }

    syncAndSetOrder((prev) => {
      const c4x6 = Number(prev.photos4x6 || 0)
      const cA4 = Number(prev.photosA4 || 0)

      const newTotal = Number(
        (c4x6 * price4x6 + cA4 * priceA4).toFixed(2),
      )

      const newPaid = Number(prev.paidAmount || 0)

      return {
        ...prev,
        totalAmount: newTotal,
        paymentStatus: getPaymentStatus(newTotal, newPaid),
      }
    })
  }

  const handleSave = () => {
    const newSource = buildSourceString(selectedSources, otherSource)
    const updated = {
      ...order,
      source: newSource,
    }
    setOrder(updated)
    updateOrder(updated)
    alert('تم حفظ التعديلات في النظام (localStorage).')
  }

  const handlePrintInvoice = () => {
    window.print()
  }

  // إنشاء دفع إلكتروني تجريبي (Mock)
  const handleCreateMockPayment = () => {
    const today = new Date().toISOString().slice(0, 10)
    const random = Math.floor(100000 + Math.random() * 900000)
    const mockId = `MOCK-${today}-${random}`
    const mockUrl = `https://payments.art-moment.test/${mockId}`

    syncAndSetOrder((prev) => ({
      ...prev,
      paymentMethod: 'online',
      onlinePaymentId: mockId,
      onlinePaymentStatus: 'pending',
      onlinePaymentProvider: 'mock',
      onlinePaymentUrl: mockUrl,
      onlinePaymentCreatedAt: today,
    }))
  }

  // اعتبار الدفع الإلكتروني تم (اختبار)
  const handleMarkMockPaid = () => {
    const today = new Date().toISOString().slice(0, 10)

    syncAndSetOrder((prev) => {
      const total = Number(prev.totalAmount || 0)
      const newPaidAmount = total > 0 ? total : Number(prev.paidAmount || 0)

      return {
        ...prev,
        paidAmount: newPaidAmount,
        paymentStatus: getPaymentStatus(total, newPaidAmount),
        onlinePaymentStatus: 'paid',
        onlinePaymentPaidAt: today,
        paymentMethod: prev.paymentMethod || 'online',
      }
    })
  }

  const onlineStatusLabel = getOnlineStatusLabel(order.onlinePaymentStatus)

  const currentSourceDisplay = buildSourceString(
    selectedSources,
    otherSource,
  )

  // إضافة ملاحظة جاهزة للملاحظات الحالية
  const handleAppendNoteTemplate = (text) => {
    syncAndSetOrder((prev) => {
      const current = prev.notes || ''
      const separator = current.trim() ? '\n' : ''
      return {
        ...prev,
        notes: current + separator + text,
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* العنوان + رجوع */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="heading-main">
          تفاصيل الطلب #{order.id}
        </h1>
        <button
          onClick={() => navigate('/app/orders')}
          className="btn-secondary"
        >
          ← الرجوع للطلبات
        </button>
              {/* كرت الفاتورة – يظهر فقط في وضع الطباعة */}
      <div className="invoice-print-root" dir="rtl">
        <div className="invoice-print-card">
          {/* رأس الفاتورة */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <img
                src={logoArtMoment}
                alt="لحظة فن"
                className="h-10 w-auto"
              />
              <div>
                <div className="font-semibold text-slate-800">
                  لحظة فن – استديو طباعة
                </div>
                <div className="text-[11px] text-slate-500">
                  جوال: {settings?.businessPhone || '05xxxxxxxx'}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-700">
              <div className="font-semibold text-slate-900">
                فاتورة طلب #{order.id}
              </div>
              <div>تاريخ الإنشاء: {order.createdAt}</div>
              {order.dueDate && (
                <div>تاريخ التسليم: {order.dueDate}</div>
              )}
            </div>
          </div>

          <hr className="my-3 border-slate-200" />

          {/* بيانات العميل والطلب */}
          <div className="grid md:grid-cols-2 gap-3 mb-3 text-xs">
            <div>
              <div className="font-semibold text-slate-800 mb-1">
                بيانات العميل
              </div>
              <div>الاسم: {order.customerName || '-'}</div>
              <div>الجوال: {order.phone || '-'}</div>
              {order.source && (
                <div>مصدر الطلب: {order.source}</div>
              )}
            </div>

            <div>
              <div className="font-semibold text-slate-800 mb-1">
                بيانات الطلب
              </div>
              <div>الحالة: {order.status}</div>
              <div>حالة الدفع: {order.paymentStatus}</div>
              {order.urgency && (
                <div>الأولوية: {order.urgency}</div>
              )}
              {order.orderType && (
                <div>نوع الطلب: {order.orderType}</div>
              )}
            </div>
          </div>

          {/* تفاصيل الصور */}
          <div className="text-xs mb-3">
            <div className="font-semibold text-slate-800 mb-1">
              تفاصيل الصور
            </div>
            <table className="w-full text-[11px] border border-slate-200 border-collapse">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="py-1 px-2 text-right">النوع</th>
                  <th className="py-1 px-2 text-right">الكمية</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 px-2">صور 4×6</td>
                  <td className="py-1 px-2">{order.photos4x6 || 0}</td>
                </tr>
                <tr>
                  <td className="py-1 px-2">صور A4</td>
                  <td className="py-1 px-2">{order.photosA4 || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* المبالغ */}
          <div className="text-xs mb-3">
            <div className="font-semibold text-slate-800 mb-1">
              المبالغ
            </div>
            <div>
              إجمالي الفاتورة:{' '}
              {(order.totalAmount || 0).toFixed(2)} ر.س
            </div>
            <div>
              المبلغ المدفوع:{' '}
              {(order.paidAmount || 0).toFixed(2)} ر.س
            </div>
            <div>
              المتبقي:{' '}
              {((order.totalAmount || 0) - (order.paidAmount || 0)).toFixed(
                2,
              )}{' '}
              ر.س
            </div>
          </div>

          {/* الملاحظات إن وجدت */}
          {order.notes && (
            <div className="text-xs mb-3">
              <div className="font-semibold text-slate-800 mb-1">
                ملاحظات
              </div>
              <div className="whitespace-pre-line text-slate-700">
                {order.notes}
              </div>
            </div>
          )}

          {/* تذييل بسيط */}
          <div className="mt-4 text-[11px] text-slate-500 text-center">
            شكراً لاختيارك لحظة فن 🤍
          </div>
        </div>
      </div>

      </div>

      {/* معلومات العميل + حالة الطلب */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* معلومات العميل قابلة للتعديل */}
        <div className="card p-4 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-800 mb-1 text-base">
            معلومات العميل (قابلة للتعديل)
          </h2>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              الاسم
            </label>
            <input
              type="text"
              name="customerName"
              value={order.customerName || ''}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="اسم العميل"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              رقم الجوال
            </label>
            <input
              type="text"
              name="phone"
              value={order.phone || ''}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="مثال: 05xxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              مصدر الطلب (يمكن اختيار أكثر من واحد)
            </label>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className="inline-flex items-center gap-1 border rounded-xl px-2 py-1 cursor-pointer text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="w-3 h-3"
                    checked={selectedSources.includes(opt)}
                    onChange={() => handleToggleSource(opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-[11px] mb-1 text-slate-500">
                مصادر أخرى (اختياري)
              </label>
              <input
                type="text"
                value={otherSource}
                onChange={handleOtherSourceChange}
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="مثال: عميل قديم، معرض، صديق..."
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              سيتم حفظ المصادر في الحقل كقيمة واحدة:{' '}
              <span className="font-mono break-all">
                {currentSourceDisplay || '(بدون مصدر محدد)'}
              </span>
            </div>
          </div>
        </div>

        {/* حالة الطلب والدفعة + الوسوم */}
        <div className="card p-4 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-800 mb-1 text-base">
            حالة الطلب والدفعة
          </h2>
          <div>
            الحالة:{' '}
            <StatusBadge status={order.status} />
          </div>
          <div>
            حالة الدفع:{' '}
            <PaymentBadge paymentStatus={order.paymentStatus} />
          </div>
          <div>
            حالة الجاهزية:{' '}
            <span className={getReadinessBadgeClasses(readiness.tone)}>
              {readiness.label}
            </span>
          </div>
          <div>
            طريقة الدفع:{' '}
            <span className="text-xs font-semibold text-slate-700">
              {renderPaymentMethod(order.paymentMethod)}
            </span>
          </div>

          {/* الوسوم: الأولوية + نوع الطلب */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-[11px] mb-1 text-slate-600">
                أولوية الطلب
              </label>
              <select
                value={order.urgency || 'عادي'}
                onChange={(e) =>
                  handleTagChange('urgency', e.target.value)
                }
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="عادي">عادي</option>
                <option value="مستعجل">مستعجل</option>
              </select>
              <div className="mt-1">
                <UrgencyTag urgency={order.urgency} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] mb-1 text-slate-600">
                نوع الطلب
              </label>
              <select
                value={order.orderType || ''}
                onChange={(e) =>
                  handleTagChange('orderType', e.target.value)
                }
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">غير محدد</option>
                <option value="هدية">هدية</option>
                <option value="ألبوم">ألبوم</option>
                <option value="لوحة جدارية">لوحة جدارية</option>
              </select>
              <div className="mt-1 text-[11px] text-slate-600">
                {order.orderType || 'لم يتم تحديد نوع الطلب بعد.'}
              </div>
            </div>
          </div>

          <div>تاريخ الإنشاء: {order.createdAt}</div>
          <div>تاريخ التسليم المطلوب: {order.dueDate || '-'}</div>
        </div>
      </div>

      {/* تفاصيل الصور والمبالغ */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-800 mb-1 text-base">
            تفاصيل الصور (قابلة للتعديل)
          </h2>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              عدد صور 4x6
            </label>
            <input
              type="number"
              min="0"
              name="photos4x6"
              value={order.photos4x6}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              عدد صور A4
            </label>
            <input
              type="number"
              min="0"
              name="photosA4"
              value={order.photosA4}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="card p-4 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-800 mb-1 text-base">
            تفاصيل المبلغ (قابلة للتعديل)
          </h2>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              المبلغ الإجمالي (ر.س)
            </label>
            <input
              type="number"
              min="0"
              name="totalAmount"
              value={order.totalAmount}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              المبلغ المدفوع / العربون (ر.س)
            </label>
            <input
              type="number"
              min="0"
              name="paidAmount"
              value={order.paidAmount}
              onChange={handleFieldChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {hasPricing ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-1 gap-2">
              <p className="text-[11px] text-slate-500">
                التسعير الحالي: 4x6 = {price4x6} ر.س ، A4 = {priceA4} ر.س
              </p>
              <button
                type="button"
                onClick={handleAutoRecalculateTotal}
                className="px-3 py-1.5 rounded-xl text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                إعادة حساب المبلغ تلقائياً
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-amber-600">
              لم يتم ضبط أسعار الصور بعد. يمكنك تعيينها من صفحة الإعدادات.
            </p>
          )}

          <div className="text-xs text-slate-700">
            المتبقي على العميل:{' '}
            <span className="font-semibold">
              {remaining} ر.س
            </span>
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              طريقة الدفع
            </label>
            <select
              value={order.paymentMethod}
              onChange={handlePaymentMethodChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="cash">نقداً / عند الاستلام</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="online">دفع إلكتروني</option>
            </select>
          </div>
        </div>
      </div>

      {/* ملاحظات + أزرار الحالة + حفظ + طباعة فاتورة */}
      <div className="card p-4 space-y-3 text-sm">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-600">
              ملاحظات إضافية
            </label>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="text-[11px] px-2 py-1 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              + إضافة ملاحظة جاهزة
            </button>
          </div>

          <textarea
            name="notes"
            value={order.notes}
            onChange={handleFieldChange}
            rows={3}
            className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          {showTemplates && (
            <div className="mt-2 flex flex-wrap gap-2">
              {noteTemplates.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAppendNoteTemplate(t)}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleChangeStatus('جديد')}
            className="btn-ghost"
            type="button"
          >
            جديد
          </button>
          <button
            onClick={() => handleChangeStatus('قيد الطباعة')}
            className="btn-ghost"
            type="button"
          >
            قيد الطباعة
          </button>
          <button
            onClick={() => handleChangeStatus('جاهز')}
            className="btn-ghost"
            type="button"
          >
            جاهز
          </button>
          <button
            onClick={handleMarkDelivered}
            type="button"
            className="btn-primary"
          >
            ✔️ تم التسليم
          </button>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={handlePrintInvoice}
              className="btn-secondary"
            >
              🧾 طباعة الفاتورة
            </button>
            <button
              onClick={handleSave}
              type="button"
              className="btn-primary"
            >
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>

      {/* الدفع الإلكتروني (تجريبي) */}
      <div className="bg-white rounded-2xl shadow-sm border border-dashed border-slate-300 p-4 space-y-3 text-sm">
        <h2 className="font-semibold text-slate-800 mb-1 text-base">
          الدفع الإلكتروني (تجريبي – للتحضير لبوابة الدفع)
        </h2>

        {order.onlinePaymentId ? (
          <div className="grid md:grid-cols-2 gap-3 text-xs md:text-sm">
            <div>
              <div className="text-slate-500 text-[11px]">
                رقم عملية الدفع
              </div>
              <div className="font-mono text-[12px] md:text-xs">
                {order.onlinePaymentId}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">
                مزود الدفع
              </div>
              <div className="text-xs text-slate-700">
                {order.onlinePaymentProvider || 'mock'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">
                حالة الدفع الإلكتروني
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {onlineStatusLabel}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">
                رابط صفحة الدفع
              </div>
              {order.onlinePaymentUrl ? (
                <a
                  href={order.onlinePaymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  فتح صفحة الدفع
                </a>
              ) : (
                <div className="text-xs text-slate-500">
                  لا يوجد رابط مسجل
                </div>
              )}
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">
                تاريخ إنشاء عملية الدفع
              </div>
              <div className="text-xs text-slate-700">
                {order.onlinePaymentCreatedAt || '-'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">
                تاريخ تأكيد الدفع
              </div>
              <div className="text-xs text-slate-700">
                {order.onlinePaymentPaidAt || '-'}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            لا يوجد دفع إلكتروني مرتبط بهذا الطلب حتى الآن. يمكنك إنشاء عملية دفع
            تجريبية لاختبار التدفق، وعند ربط بوابة حقيقية لاحقاً سيتم استبدال هذا
            الجزء بنداء فعلي للـ API.
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs mt-2">
          <button
            onClick={handleCreateMockPayment}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
          >
            إنشاء دفع إلكتروني تجريبي
          </button>
          <button
            onClick={handleMarkMockPaid}
            disabled={!order.onlinePaymentId}
            className="px-3 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            اعتبار الدفع الإلكتروني تم (اختبار)
          </button>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          * حالياً يتم تحديث حالة الدفع محلياً فقط (localStorage). عند ربط بوابة
          الدفع الفعلية سيتم استخدام Webhook من مزود الخدمة لتحديث حالة الطلب
          تلقائياً وبشكل موثوق.
        </p>
      </div>
    </div>
  )
}

/* ====== دوال مساعدة ====== */

function parseSourceForUI(sourceValue) {
  if (!sourceValue) {
    return { selected: [], other: '' }
  }

  const raw = String(sourceValue)
  const parts = raw
    .split(/[\+\-,/|،]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const selected = []
  const others = []
  const optsSet = new Set(SOURCE_OPTIONS)

  for (const part of parts) {
    if (optsSet.has(part)) {
      if (!selected.includes(part)) selected.push(part)
    } else {
      others.push(part)
    }
  }

  return {
    selected,
    other: others.join('، '),
  }
}

function buildSourceString(selected, other) {
  const parts = [...selected]
  if (other && other.trim()) {
    parts.push(other.trim())
  }
  if (!parts.length) return ''
  return parts.join(' + ')
}

function getPaymentStatus(total, paid) {
  const t = Number(total || 0)
  const p = Number(paid || 0)

  if (t <= 0) return 'غير مدفوع'
  if (p <= 0) return 'غير مدفوع'
  if (p >= t) return 'مدفوع بالكامل'
  return 'مدفوع جزئياً'
}

function getOnlineStatusLabel(status) {
  if (!status) return 'لا يوجد عملية دفع إلكترونية'
  if (status === 'pending') return 'قيد الانتظار'
  if (status === 'paid') return 'مدفوع إلكترونياً'
  if (status === 'failed') return 'فشل في الدفع الإلكتروني'
  if (status === 'refunded') return 'تم إرجاع المبلغ'
  return status
}

function renderPaymentMethod(method) {
  if (method === 'cash') return 'نقداً / عند الاستلام'
  if (method === 'transfer') return 'تحويل بنكي'
  if (method === 'online') return 'دفع إلكتروني'
  return 'غير محدد'
}

function StatusBadge({ status }) {
  let classes =
    'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium '

  if (status === 'جديد') {
    classes += 'bg-blue-100 text-blue-800'
  } else if (status === 'قيد الطباعة') {
    classes += 'bg-amber-100 text-amber-800'
  } else if (status === 'جاهز') {
    classes += 'bg-emerald-100 text-emerald-800'
  } else if (status === 'تم التسليم') {
    classes += 'bg-slate-100 text-slate-800'
  } else if (status === 'ملغي') {
    classes += 'bg-red-100 text-red-800'
  } else {
    classes += 'bg-slate-100 text-slate-800'
  }

  return <span className={classes}>{status}</span>
}

function PaymentBadge({ paymentStatus }) {
  let classes =
    'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium '

  if (paymentStatus === 'مدفوع بالكامل') {
    classes += 'bg-emerald-100 text-emerald-800'
  } else if (paymentStatus === 'مدفوع جزئياً') {
    classes += 'bg-amber-100 text-amber-800'
  } else if (paymentStatus === 'غير مدفوع') {
    classes += 'bg-red-100 text-red-800'
  } else {
    classes += 'bg-slate-100 text-slate-800'
  }

  return <span className={classes}>{paymentStatus}</span>
}

// ألوان بادج حالة الجاهزية
function getReadinessBadgeClasses(tone) {
  let classes =
    'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium '

  if (tone === 'success') {
    classes += 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  } else if (tone === 'danger') {
    classes += 'bg-red-50 text-red-700 border border-red-100'
  } else if (tone === 'warning') {
    classes += 'bg-amber-50 text-amber-800 border border-amber-100'
  } else {
    classes += 'bg-slate-50 text-slate-700 border border-slate-200'
  }

  return classes
}

function UrgencyTag({ urgency }) {
  const value = urgency || 'عادي'
  let classes =
    'inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium '

  if (value === 'مستعجل') {
    classes += 'bg-red-50 text-red-700 border border-red-100'
  } else {
    classes += 'bg-slate-50 text-slate-700 border border-slate-200'
  }

  return <span className={classes}>{value}</span>
}

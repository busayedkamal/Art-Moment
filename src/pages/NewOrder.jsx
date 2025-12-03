// src/pages/NewOrder.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addOrder, generateOrderId } from '../storage/orderStorage.js'
import { loadSettings } from '../storage/settingsStorage.js'

// نفس الخيارات الموجودة في OrderDetails
const SOURCE_OPTIONS = ['واتساب', 'تيليغرام', 'إنستقرام', 'ايميل', 'مباشر']

export default function NewOrder() {
  const navigate = useNavigate()

  // إعدادات التسعير من صفحة الإعدادات
  const settings = loadSettings()
  const price4x6 = Number(settings.price4x6 ?? 0)
  const priceA4 = Number(settings.priceA4 ?? 0)
  const hasPricing = price4x6 > 0 || priceA4 > 0

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    photos4x6: '',
    photosA4: '',
    totalAmount: '',
    paidAmount: '',
    dueDate: '',
    notes: '',
  })

  // واجهة اختيار المصادر (متعددة + حقل "أخرى")
  const [selectedSources, setSelectedSources] = useState([])
  const [otherSource, setOtherSource] = useState('')

  const handleToggleSource = (opt) => {
    setSelectedSources((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt],
    )
  }

  const handleChangeOtherSource = (e) => {
    setOtherSource(e.target.value)
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => {
      let next = { ...prev, [name]: value }

      // حاسبة تلقائية للمبلغ الإجمالي عند تغيير عدد الصور
      if (hasPricing && (name === 'photos4x6' || name === 'photosA4')) {
        const c4x6 =
          name === 'photos4x6'
            ? Number(value || 0)
            : Number(next.photos4x6 || 0)
        const cA4 =
          name === 'photosA4'
            ? Number(value || 0)
            : Number(next.photosA4 || 0)

        const newTotal = c4x6 * price4x6 + cA4 * priceA4
        next.totalAmount = newTotal > 0 ? newTotal.toFixed(2) : ''
      }

      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const id = generateOrderId()
    const createdAt = new Date().toISOString().slice(0, 10)

    const totalAmount = Number(form.totalAmount || 0)
    const paidAmount = Number(form.paidAmount || 0)
    const paymentStatus = getPaymentStatus(totalAmount, paidAmount)

    // توحيد تنسيق مصدر الطلب مع OrderDetails
    const source = buildSourceString(selectedSources, otherSource)

    const newOrder = {
      id,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      source,
      photos4x6: Number(form.photos4x6 || 0),
      photosA4: Number(form.photosA4 || 0),
      totalAmount,
      paidAmount,
      paymentStatus,
      status: 'جديد',
      createdAt,
      dueDate: form.dueDate || '',
      notes: form.notes || '',
      // أول سجل في الـ Timeline (إنشاء الطلب)
      logs: [
        {
          type: 'create',
          field: 'order',
          from: null,
          to: 'إنشاء الطلب من نموذج الإضافة',
          at: createdAt,
          meta: {
            customerName: form.customerName.trim() || undefined,
            phone: form.phone.trim() || undefined,
            source,
          },
        },
      ],
    }

    addOrder(newOrder)

    alert(`تم إنشاء الطلب الجديد برقم: ${id}`)
    navigate('/app/orders')
  }

  const currentSourceDisplay = buildSourceString(
    selectedSources,
    otherSource,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          إضافة طلب جديد
        </h1>
        <button
          type="button"
          onClick={() => navigate('/app/orders')}
          className="px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-300 hover:bg-slate-100"
        >
          ← الرجوع للطلبات
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4 text-sm"
      >
        {/* بيانات العميل */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1 text-slate-600">
              اسم العميل
            </label>
            <input
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              required
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              رقم الجوال
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="مثال: 05xxxxxxxx"
            />
          </div>
        </div>

        {/* مصادر الطلب + تاريخ التسليم */}
        <div className="grid md:grid-cols-2 gap-3">
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
                onChange={handleChangeOtherSource}
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="مثال: عميل قديم، معرض، صديق..."
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              سيتم حفظ المصادر في حقل واحد بالشكل:{' '}
              <span className="font-mono break-all">
                {currentSourceDisplay || '(لم يتم اختيار مصدر بعد)'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              تاريخ التسليم المطلوب
            </label>
            <input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        {/* عدد الصور */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1 text-slate-600">
              عدد صور 4x6
            </label>
            <input
              type="number"
              min="0"
              name="photos4x6"
              value={form.photos4x6}
              onChange={handleChange}
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
              value={form.photosA4}
              onChange={handleChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        {/* المبالغ */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1 text-slate-600">
              المبلغ الإجمالي (ر.س)
            </label>
            <input
              type="number"
              min="0"
              name="totalAmount"
              value={form.totalAmount}
              onChange={handleChange}
              readOnly={hasPricing}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                hasPricing ? 'bg-slate-50 cursor-not-allowed' : ''
              }`}
            />
            {hasPricing && (
              <p className="mt-1 text-[11px] text-slate-500">
                يتم احتساب المبلغ تلقائياً بناءً على عدد الصور:
                4x6 = {price4x6} ر.س ، A4 = {priceA4} ر.س
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              المبلغ المدفوع / العربون (ر.س)
            </label>
            <input
              type="number"
              min="0"
              name="paidAmount"
              value={form.paidAmount}
              onChange={handleChange}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        {/* ملاحظات */}
        <div>
          <label className="block text-xs mb-1 text-slate-600">
            ملاحظات إضافية
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* أزرار الحفظ / الإلغاء */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate('/app/orders')}
            className="px-3 py-2 rounded-xl border text-xs hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            حفظ الطلب
          </button>
        </div>
      </form>
    </div>
  )
}

/* ====== دوال مساعدة ====== */

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

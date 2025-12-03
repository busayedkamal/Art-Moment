// src/pages/Reports.jsx
import { useMemo, useState } from 'react'
import { loadOrders } from '../storage/orderStorage.js'
import {
  StatusBadge,
  PaymentBadge,
} from '../components/StatusBadges.jsx'

const MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

function getMonthInfo(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null

  const year = d.getFullYear()
  const monthIndex = d.getMonth()
  const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  const label = `${MONTH_NAMES[monthIndex]} ${year}`

  return { key, label, year, monthIndex }
}

// دالة مساعدة لتصدير CSV (يُفتح في Excel)
function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return

  const escapeCell = (value) => {
    const v = value === null || value === undefined ? '' : String(value)
    const escaped = v.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const csvContent =
    '\uFEFF' +
    rows
      .map((row) => row.map(escapeCell).join(','))
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const orders = loadOrders() || []

  const monthGroups = useMemo(() => {
    const map = new Map()

    for (const o of orders) {
      const info = getMonthInfo(o.createdAt)
      const key = info ? info.key : 'unknown'
      const label = info ? info.label : 'تاريخ غير معروف'

      const existing = map.get(key)
      if (existing) {
        existing.orders.push(o)
      } else {
        map.set(key, {
          key,
          label,
          orders: [o],
          year: info?.year ?? 0,
          monthIndex: info?.monthIndex ?? 0,
        })
      }
    }

    const arr = Array.from(map.values())

    // ترتيب من الأحدث إلى الأقدم
    arr.sort((a, b) => {
      if (a.key === 'unknown') return 1
      if (b.key === 'unknown') return -1
      if (a.year !== b.year) return b.year - a.year
      return b.monthIndex - a.monthIndex
    })

    return arr
  }, [orders])

  const [selectedMonthKey, setSelectedMonthKey] = useState('all')

  const filteredOrders = useMemo(() => {
    if (selectedMonthKey === 'all') return orders
    const group = monthGroups.find((g) => g.key === selectedMonthKey)
    return group ? group.orders : []
  }, [orders, monthGroups, selectedMonthKey])

  const totals = useMemo(() => {
    const totalOrders = filteredOrders.length
    const deliveredOrders = filteredOrders.filter(
      (o) => o.status === 'تم التسليم',
    ).length
    const inProgressOrders = filteredOrders.filter(
      (o) => o.status === 'قيد الطباعة' || o.status === 'جاهز',
    ).length
    const newOrders = filteredOrders.filter(
      (o) => o.status === 'جديد',
    ).length

    const totalAmount = filteredOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0,
    )
    const totalPaid = filteredOrders.reduce(
      (sum, o) => sum + (o.paidAmount || 0),
      0,
    )
    const totalUnpaid = totalAmount - totalPaid

    return {
      totalOrders,
      deliveredOrders,
      inProgressOrders,
      newOrders,
      totalAmount,
      totalPaid,
      totalUnpaid,
    }
  }, [filteredOrders])

  const monthlySummary = useMemo(() => {
    return monthGroups.map((g) => {
      const totalAmount = g.orders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0,
      )
      const totalPaid = g.orders.reduce(
        (sum, o) => sum + (o.paidAmount || 0),
        0,
      )
      const totalUnpaid = totalAmount - totalPaid
      const ordersCount = g.orders.length
      return {
        key: g.key,
        label: g.label,
        totalAmount,
        totalPaid,
        totalUnpaid,
        ordersCount,
      }
    })
  }, [monthGroups])

  const currentLabel =
    selectedMonthKey === 'all'
      ? 'كل الأشهر'
      : monthGroups.find((g) => g.key === selectedMonthKey)?.label ||
        'شهر غير معروف'

  // تصدير ملخص الأشهر
  const handleExportMonthlySummary = () => {
    if (!monthlySummary.length) {
      alert('لا توجد بيانات لتصدير ملخص شهري.')
      return
    }

    const rows = [
      [
        'الشهر',
        'عدد الطلبات',
        'إجمالي الفواتير',
        'إجمالي المدفوع',
        'إجمالي المتبقي',
      ],
      ...monthlySummary.map((m) => [
        m.label,
        m.ordersCount,
        m.totalAmount,
        m.totalPaid,
        m.totalUnpaid,
      ]),
    ]

    downloadCSV('art-moment-monthly-summary.csv', rows)
  }

  // تصدير الطلبات المعروضة حالياً (حسب الشهر المحدد أو الكل)
  const handleExportCurrentOrders = () => {
    if (!filteredOrders.length) {
      alert('لا توجد طلبات لتصديرها في هذا النطاق.')
      return
    }

    const rows = [
      [
        'رقم الطلب',
        'العميل',
        'الجوال',
        'المصدر',
        'الحالة',
        'حالة الدفع',
        'المبلغ',
        'المدفوع',
        'تاريخ الإنشاء',
        'تاريخ التسليم',
      ],
      ...filteredOrders.map((o) => [
        o.id,
        o.customerName,
        o.phone,
        o.source,
        o.status,
        o.paymentStatus,
        o.totalAmount,
        o.paidAmount,
        o.createdAt,
        o.dueDate,
      ]),
    ]

    const suffix = selectedMonthKey === 'all' ? 'all' : selectedMonthKey
    downloadCSV(`art-moment-orders-${suffix}.csv`, rows)
  }

  return (
    <div className="space-y-4">
      {/* العنوان + وصف بسيط */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="heading-main">التقارير الشهرية</h1>
          <p className="text-[11px] md:text-xs text-slate-500">
            تقارير الإيرادات الشهرية، حالات الطلبات، والتفاصيل المالية حسب الشهر.
          </p>
        </div>
      </div>

      {/* اختيار الشهر + أزرار التصدير */}
      <div className="card space-y-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">اختر الشهر</span>
            <select
              className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              <option value="all">كل الأشهر</option>
              {monthGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 md:col-span-2 flex items-end">
            التقرير الحالي يعرض البيانات لـ:{' '}
            <span className="font-semibold mr-1">{currentLabel}</span>
          </div>
        </div>

        {/* أزرار التصدير */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={handleExportMonthlySummary}
            className="btn-secondary"
          >
            تصدير ملخص الأشهر (CSV)
          </button>
          <button
            onClick={handleExportCurrentOrders}
            className="btn-secondary"
          >
            تصدير الطلبات المعروضة (CSV)
          </button>
        </div>
      </div>

      {/* كروت الأعداد */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عدد الطلبات" value={totals.totalOrders} />
        <StatCard label="طلبات جديدة" value={totals.newOrders} />
        <StatCard
          label="قيد الطباعة / جاهز"
          value={totals.inProgressOrders}
        />
        <StatCard label="تم التسليم" value={totals.deliveredOrders} />
      </div>

      {/* كروت المبالغ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoneyCard label="إجمالي الفواتير" value={totals.totalAmount} />
        <MoneyCard label="إجمالي المدفوع" value={totals.totalPaid} />
        <MoneyCard
          label="إجمالي المتبقي"
          value={totals.totalUnpaid}
          highlightNegative
        />
      </div>

      {/* جدول ملخص شهري لكل شهر */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 text-sm md:text-base mb-3">
          ملخص شهري
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-right">الشهر</th>
                <th className="text-right">عدد الطلبات</th>
                <th className="text-right">إجمالي الفواتير</th>
                <th className="text-right">إجمالي المدفوع</th>
                <th className="text-right">إجمالي المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((m) => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="py-2">{m.label}</td>
                  <td>{m.ordersCount}</td>
                  <td className="text-xs">{m.totalAmount} ر.س</td>
                  <td className="text-xs">{m.totalPaid} ر.س</td>
                  <td className="text-xs">{m.totalUnpaid} ر.س</td>
                </tr>
              ))}

              {monthlySummary.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا توجد بيانات كافية لإنشاء تقرير شهري.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* جدول الطلبات في الشهر المحدد */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 text-sm md:text-base mb-3">
          الطلبات في {currentLabel}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-right">رقم الطلب</th>
                <th className="text-right">العميل</th>
                <th className="text-right">الجوال</th>
                <th className="text-right">الحالة</th>
                <th className="text-right">حالة الدفع</th>
                <th className="text-right">المبلغ</th>
                <th className="text-right">المدفوع</th>
                <th className="text-right">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-[11px]">{o.id}</td>
                  <td>{o.customerName}</td>
                  <td className="text-xs text-slate-600">{o.phone}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    <PaymentBadge paymentStatus={o.paymentStatus} />
                  </td>
                  <td className="text-xs">{o.totalAmount} ر.س</td>
                  <td className="text-xs">{o.paidAmount} ر.س</td>
                  <td className="text-xs text-slate-500">{o.createdAt}</td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا توجد طلبات في هذا النطاق.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* كرت عدد بسيط */
function StatCard({ label, value }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-slate-900">
        {value}
      </div>
    </div>
  )
}

/* كرت مالي */
function MoneyCard({ label, value, highlightNegative = false }) {
  const safeValue = typeof value === 'number' ? value : 0
  const isHighlight = highlightNegative && safeValue > 0
  const extra =
    isHighlight ? 'bg-amber-50 border-amber-100' : ''

  return (
    <div className={`card ${extra}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-slate-900">
        {safeValue.toFixed(2)} ر.س
      </div>
    </div>
  )
}

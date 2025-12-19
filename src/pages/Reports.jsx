// src/pages/Reports.jsx
import { useMemo, useState } from 'react'
import { loadOrders } from '../storage/orderStorage.js'

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

// دالة مساعدة لتصدير CSV (يفتح في إكسل)
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
  // القراءة من LocalStorage فقط (نسخة V1)
  const [orders, setOrders] = useState(() => loadOrders())
  const [selectedMonthKey, setSelectedMonthKey] = useState('all')

  const handleReload = () => {
    setOrders(loadOrders())
  }

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
    const newOrders = filteredOrders.filter((o) => o.status === 'جديد').length

    const totalAmount = filteredOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0,
    )
    const totalPaid = filteredOrders.reduce(
      (sum, o) => sum + Number(o.paidAmount || 0),
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
        (sum, o) => sum + Number(o.totalAmount || 0),
        0,
      )
      const totalPaid = g.orders.reduce(
        (sum, o) => sum + Number(o.paidAmount || 0),
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
      ['الشهر', 'عدد الطلبات', 'إجمالي الفواتير', 'إجمالي المدفوع', 'إجمالي المتبقي'],
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

  const hasAnyData = orders && orders.length > 0

  return (
    <div className="space-y-4">
      {/* العنوان + زر تحديث من LocalStorage */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          التقارير الشهرية
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleReload}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50"
          >
            إعادة تحميل البيانات من المتصفح
          </button>
          {!hasAnyData && (
            <span className="text-slate-500">
              لا توجد طلبات حالياً في النظام (LocalStorage).
            </span>
          )}
        </div>
      </div>

      {/* اختيار الشهر + أزرار التصدير */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 space-y-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">اختر الشهر</span>
            <select
              className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
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
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
          >
            تصدير ملخص الأشهر (CSV)
          </button>
          <button
            onClick={handleExportCurrentOrders}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
        <h2 className="font-semibold text-slate-800 text-sm md:text-base mb-3">
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
        <h2 className="font-semibold text-slate-800 text-sm md:text-base mb-3">
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
                  <td className="text-xs text-slate-600">{o.status}</td>
                  <td className="text-xs">{o.totalAmount} ر.س</td>
                  <td className="text-xs">{o.paidAmount} ر.س</td>
                  <td className="text-xs text-slate-500">{o.createdAt}</td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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

function StatCard({ label, value }) {
  const v = Number(value || 0)
  return (
    <div className="rounded-2xl shadow-sm border bg-white border-slate-200 p-3 md:p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold">{v}</div>
    </div>
  )
}

function MoneyCard({ label, value, highlightNegative = false }) {
  const v = Number(value || 0)
  const isHighlight = highlightNegative && v > 0
  const bg = isHighlight
    ? 'bg-amber-50 border-amber-100'
    : 'bg-white border-slate-200'

  return (
    <div className={`rounded-2xl shadow-sm border p-3 md:p-4 ${bg}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold">
        {v.toFixed(2)} ر.س
      </div>
    </div>
  )
}

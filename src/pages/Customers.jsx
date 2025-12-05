// src/pages/Customers.jsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrdersData } from '../hooks/useOrdersData.js'

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

export default function Customers() {
  const navigate = useNavigate()
  const { orders, loading, error, reload } = useOrdersData()

  const [sortBy, setSortBy] = useState('totalPaid')
  const [dir, setDir] = useState('desc')
  const [search, setSearch] = useState('')

  const stats = useMemo(() => {
    const map = new Map()

    for (const o of orders) {
      const key = `${o.customerName || 'بدون اسم'}__${o.phone || ''}`
      const cur = map.get(key) || {
        customerName: o.customerName || 'بدون اسم',
        phone: o.phone || '',
        ordersCount: 0,
        totalAmount: 0,
        totalPaid: 0,
        lastOrderDate: '',
      }

      cur.ordersCount += 1
      cur.totalAmount += Number(o.totalAmount || 0)
      cur.totalPaid += Number(o.paidAmount || 0)

      if (!cur.lastOrderDate || (o.createdAt && o.createdAt > cur.lastOrderDate)) {
        cur.lastOrderDate = o.createdAt || ''
      }

      map.set(key, cur)
    }

    let list = Array.from(map.values())

    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(term) ||
          c.phone.includes(term),
      )
    }

    list.sort((a, b) => {
      if (sortBy === 'name') {
        const aName = a.customerName || ''
        const bName = b.customerName || ''
        return dir === 'asc'
          ? aName.localeCompare(bName, 'ar')
          : bName.localeCompare(aName, 'ar')
      }

      let vA = 0
      let vB = 0

      if (sortBy === 'totalPaid') {
        vA = a.totalPaid
        vB = b.totalPaid
      } else if (sortBy === 'totalAmount') {
        vA = a.totalAmount
        vB = b.totalAmount
      } else if (sortBy === 'ordersCount') {
        vA = a.ordersCount
        vB = b.ordersCount
      }

      return dir === 'asc' ? vA - vB : vB - vA
    })

    return list.map((c) => ({
      ...c,
      totalUnpaid: c.totalAmount - c.totalPaid,
    }))
  }, [orders, sortBy, dir, search])

  const top3 = stats.slice(0, 3)

  const goToCustomerOrders = (customerName, phone) => {
    const q = encodeURIComponent(`${customerName} ${phone}`)
    navigate(`/app/orders?customer=${q}`)
  }

  const handleExportCustomers = () => {
    if (!stats.length) {
      alert('لا توجد بيانات عملاء لتصديرها.')
      return
    }

    const rows = [
      [
        'العميل',
        'رقم الجوال',
        'عدد الطلبات',
        'إجمالي الفواتير',
        'إجمالي المدفوع',
        'المتبقي',
        'تاريخ آخر طلب',
      ],
      ...stats.map((c) => [
        c.customerName,
        c.phone,
        c.ordersCount,
        c.totalAmount,
        c.totalPaid,
        c.totalUnpaid,
        c.lastOrderDate || '',
      ]),
    ]

    downloadCSV('art-moment-customers.csv', rows)
  }

  return (
    <div className="space-y-4">
      {/* العنوان + حالة التحميل/الخطأ + زر تحديث */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          العملاء
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {loading && (
            <span className="text-slate-500">جاري تحميل الطلبات من الخادم...</span>
          )}
          {error && !loading && (
            <span className="text-red-500 max-w-xs text-right">{error}</span>
          )}
          <button
            type="button"
            onClick={reload}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* فلاتر + زر التصدير */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder="بحث باسم العميل / رقم الجوال"
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="totalPaid">الأكثر دفعًا</option>
            <option value="totalAmount">الأعلى فاتورة</option>
            <option value="ordersCount">الأكثر طلبًا</option>
            <option value="name">الاسم (أ-ي)</option>
          </select>

          <select
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          >
            <option value="desc">تنازلي</option>
            <option value="asc">تصاعدي</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={handleExportCustomers}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
          >
            تصدير قائمة العملاء (CSV)
          </button>
        </div>
      </div>

      {/* أعلى 3 عملاء */}
      <div className="grid gap-4 md:grid-cols-3">
        {top3.map((c) => (
          <div
            key={c.customerName + c.phone}
            className="rounded-2xl shadow-sm border bg-white border-slate-200 p-4"
          >
            <div className="text-sm font-semibold text-slate-800">
              {c.customerName}
            </div>
            <div className="text-xs text-slate-500">{c.phone}</div>
            <div className="mt-2 text-xs text-slate-600">
              إجمالي الطلبات:{' '}
              <span className="font-semibold">{c.ordersCount}</span>
            </div>
            <div className="text-xs text-slate-600">
              إجمالي الفواتير:{' '}
              <span className="font-semibold">{c.totalAmount} ر.س</span>
            </div>
            <div className="text-xs text-slate-600">
              إجمالي المدفوع:{' '}
              <span className="font-semibold">{c.totalPaid} ر.س</span>
            </div>
            <div className="text-xs text-slate-600">
              المتبقي:{' '}
              <span className="font-semibold">{c.totalUnpaid} ر.س</span>
            </div>
            <button
              onClick={() => goToCustomerOrders(c.customerName, c.phone)}
              className="mt-3 px-3 py-2 text-xs rounded-xl border hover:bg-slate-100"
            >
              عرض طلبات هذا العميل
            </button>
          </div>
        ))}

        {top3.length === 0 && !loading && (
          <div className="md:col-span-3 text-xs text-slate-400 text-center py-4">
            لا توجد بيانات عملاء حتى الآن.
          </div>
        )}
      </div>

      {/* جدول كل العملاء */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-right">العميل</th>
                <th className="text-right">الجوال</th>
                <th className="text-right">عدد الطلبات</th>
                <th className="text-right">إجمالي الفواتير</th>
                <th className="text-right">إجمالي المدفوع</th>
                <th className="text-right">المتبقي</th>
                <th className="text-right">آخر طلب</th>
                <th className="text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((c) => (
                <tr
                  key={c.customerName + c.phone}
                  className="border-b last:border-0"
                >
                  <td className="py-2">{c.customerName}</td>
                  <td className="text-xs text-slate-600">{c.phone}</td>
                  <td>{c.ordersCount}</td>
                  <td className="text-xs">{c.totalAmount} ر.س</td>
                  <td className="text-xs">{c.totalPaid} ر.س</td>
                  <td className="text-xs">{c.totalUnpaid} ر.س</td>
                  <td className="text-xs text-slate-500">
                    {c.lastOrderDate || '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => goToCustomerOrders(c.customerName, c.phone)}
                      className="px-3 py-1.5 text-xs rounded-xl border hover:bg-slate-100"
                    >
                      طلباته
                    </button>
                  </td>
                </tr>
              ))}

              {stats.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا يوجد عملاء مطابقة لنتائج البحث.
                  </td>
                </tr>
              )}

              {stats.length === 0 && loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    جاري تحميل البيانات...
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

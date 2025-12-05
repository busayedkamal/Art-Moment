// src/pages/Orders.jsx
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOrdersData } from '../hooks/useOrdersData.js'
import { getReadinessInfo } from '../utils/readinessHelpers.js'

export default function Orders() {
  const navigate = useNavigate()
  const location = useLocation()

  // قراءة فلتر العميل من الرابط إن وجد ?customer=
  const params = new URLSearchParams(location.search)
  const initialSearch = params.get('customer') || ''

  const { orders, loading, error, reload } = useOrdersData()

  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState('all') // all | new | inprogress | ready | delivered | canceled
  const [paymentFilter, setPaymentFilter] = useState('all') // all | unpaid | partial | paid
  const [todayOnly, setTodayOnly] = useState(false) // جاهز للتسليم اليوم فقط

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    const todayStr = new Date().toISOString().slice(0, 10)

    return [...orders]
      .filter((o) => {
        // البحث
        if (term) {
          const haystack = `${o.customerName || ''} ${o.phone || ''} ${
            o.id || ''
          }`
            .toLowerCase()
            .trim()
          if (!haystack.includes(term)) return false
        }

        // فلتر الحالة
        if (statusFilter !== 'all') {
          if (statusFilter === 'new' && o.status !== 'جديد') return false
          if (statusFilter === 'inprogress' && o.status !== 'قيد الطباعة')
            return false
          if (statusFilter === 'ready' && o.status !== 'جاهز') return false
          if (statusFilter === 'delivered' && o.status !== 'تم التسليم')
            return false
          if (statusFilter === 'canceled' && o.status !== 'ملغي') return false
        }

        // فلتر حالة الدفع
        if (paymentFilter !== 'all') {
          if (paymentFilter === 'unpaid' && o.paymentStatus !== 'غير مدفوع')
            return false
          if (paymentFilter === 'partial' && o.paymentStatus !== 'مدفوع جزئياً')
            return false
          if (paymentFilter === 'paid' && o.paymentStatus !== 'مدفوع بالكامل')
            return false
        }

        // جاهز للتسليم اليوم
        if (todayOnly) {
          if (!o.dueDate || o.dueDate !== todayStr) return false
          if (o.status !== 'جاهز' && o.status !== 'قيد الطباعة') return false
        }

        return true
      })
      .sort((a, b) => {
        const aDate = a.createdAt || ''
        const bDate = b.createdAt || ''
        return bDate.localeCompare(aDate) // الأحدث أولاً
      })
  }, [orders, search, statusFilter, paymentFilter, todayOnly])

  return (
    <div className="space-y-4">
      {/* العنوان + حالة التحميل/الخطأ + زر تحديث + زر إضافة طلب */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          الطلبات
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

          <button
            type="button"
            onClick={() => navigate('/app/orders/new')}
            className="px-3 py-1.5 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700"
          >
            + إضافة طلب جديد
          </button>
        </div>
      </div>

      {/* فلاتر أعلى الجدول */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 space-y-3 text-sm">
        <div className="grid gap-2 md:grid-cols-4">
          <input
            type="text"
            placeholder="بحث باسم العميل / الجوال / رقم الطلب"
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="inprogress">قيد الطباعة</option>
            <option value="ready">جاهز</option>
            <option value="delivered">تم التسليم</option>
            <option value="canceled">ملغي</option>
          </select>

          <select
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">كل حالات الدفع</option>
            <option value="unpaid">غير مدفوع</option>
            <option value="partial">مدفوع جزئياً</option>
            <option value="paid">مدفوع بالكامل</option>
          </select>

          <label className="flex items-center gap-2 text-xs md:text-sm text-slate-700">
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span>جاهز للتسليم اليوم</span>
          </label>
        </div>
      </div>

      {/* جدول الطلبات */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-right">رقم الطلب</th>
                <th className="text-right">العميل</th>
                <th className="text-right">الجوال</th>
                <th className="text-right">الحالة</th>
                <th className="text-right">حالة الدفع</th>
                <th className="text-right">الجاهزية</th>
                <th className="text-right">المبلغ</th>
                <th className="text-right">التسليم</th>
                <th className="text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/app/orders/${o.id}`)}
                >
                  <td className="py-2 font-mono text-[11px]">{o.id}</td>
                  <td>{o.customerName}</td>
                  <td className="text-xs text-slate-600">{o.phone}</td>
                  <td className="text-xs text-slate-700">{o.status}</td>
                  <td className="text-xs">
                    <PaymentBadge paymentStatus={o.paymentStatus} />
                  </td>
                  <td className="text-xs">
                    <ReadinessBadge order={o} />
                  </td>
                  <td className="text-xs">
                    {Number(o.totalAmount || 0).toFixed(2)} ر.س
                  </td>
                  <td className="text-xs text-slate-500">{o.dueDate || '-'}</td>
                  <td
                    className="text-xs text-blue-600 underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/app/orders/${o.id}`)
                    }}
                  >
                    تفاصيل
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا توجد طلبات مطابقة للفلاتر الحالية.
                  </td>
                </tr>
              )}

              {filteredOrders.length === 0 && loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    جاري تحميل الطلبات...
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

/* === مكوّنات صغيرة === */

function PaymentBadge({ paymentStatus }) {
  let classes =
    'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium '

  if (paymentStatus === 'مدفوع بالكامل') {
    classes += 'bg-emerالد-100 text-emerald-800'
  } else if (paymentStatus === 'مدفوع جزئياً') {
    classes += 'bg-amber-100 text-amber-800'
  } else if (paymentStatus === 'غير مدفوع') {
    classes += 'bg-red-100 text-red-800'
  } else {
    classes += 'bg-slate-100 text-slate-800'
  }

  return <span className={classes}>{paymentStatus || 'غير محدد'}</span>
}

function ReadinessBadge({ order }) {
  const info = getReadinessInfo(order || {})
  const classes = getReadinessBadgeClasses(info.tone)

  return <span className={classes}>{info.label}</span>
}

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

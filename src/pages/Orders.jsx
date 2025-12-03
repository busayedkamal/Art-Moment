// src/pages/Orders.jsx
import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { loadOrders } from '../storage/orderStorage.js'
import { getReadinessInfo } from '../utils/readinessHelpers.js'

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'جديد', label: 'جديد' },
  { value: 'قيد الطباعة', label: 'قيد الطباعة' },
  { value: 'جاهز', label: 'جاهز' },
  { value: 'تم التسليم', label: 'تم التسليم' },
  { value: 'ملغي', label: 'ملغي' },
]

export default function Orders() {
  const navigate = useNavigate()
  const location = useLocation()

  const searchParam = new URLSearchParams(location.search).get('customer') || ''
  const [search, setSearch] = useState(searchParam)
  const [statusFilter, setStatusFilter] = useState('all')

  // نقرأ الطلبات من LocalStorage في كل ريندر
  const orders = loadOrders()

  const filteredOrders = useMemo(() => {
    let list = [...orders]

    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter((o) => {
        const name = (o.customerName || '').toLowerCase()
        const phone = o.phone || ''
        const id = String(o.id || '')
        const src = (o.source || '').toLowerCase()
        return (
          name.includes(term) ||
          phone.includes(term) ||
          id.includes(term) ||
          src.includes(term)
        )
      })
    }

    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter)
    }

    // الأحدث أولاً
    list.sort((a, b) => {
      const aDate = a.createdAt || ''
      const bDate = b.createdAt || ''
      if (aDate === bDate) return String(b.id).localeCompare(String(a.id))
      return bDate.localeCompare(aDate)
    })

    return list
  }, [orders, search, statusFilter])

  const handleAddNew = () => {
    navigate('/app/orders/new')
  }

  const handleOpenDetails = (id) => {
    navigate(`/app/orders/${id}`)
  }

  return (
    <div className="space-y-4">
      {/* العنوان + زر إضافة طلب */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          الطلبات
        </h1>
        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
        >
          + إضافة طلب جديد
        </button>
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4 space-y-3 text-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder="بحث برقم الطلب، اسم العميل، الجوال أو المصدر"
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border rounded-xl px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="text-[11px] text-slate-500 flex items-center">
            عدد الطلبات المطابقة:{' '}
            <span className="font-semibold mr-1">{filteredOrders.length}</span>
          </div>
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
                <th className="text-right">الجاهزية</th>
                <th className="text-right">المبلغ</th>
                <th className="text-right">المدفوع</th>
                <th className="text-right">تاريخ التسليم</th>
                <th className="text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const readiness = getReadinessInfo(o)
                const remaining =
                  Number(o.totalAmount || 0) - Number(o.paidAmount || 0)

                return (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-[11px]">{o.id}</td>
                    <td>{o.customerName}</td>
                    <td className="text-xs text-slate-600">{o.phone}</td>
                    <td className="text-xs">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="text-xs">
                      <span className={getReadinessBadgeClasses(readiness.tone)}>
                        {readiness.label}
                      </span>
                    </td>
                    <td className="text-xs">{o.totalAmount || 0} ر.س</td>
                    <td className="text-xs">
                      {o.paidAmount || 0} ر.س
                      {remaining > 0 && (
                        <span className="text-[10px] text-amber-600 mr-1">
                          (متبقي {remaining} ر.س)
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">
                      {o.dueDate || '-'}
                    </td>
                    <td className="text-xs">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(o.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100"
                      >
                        تفاصيل
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا توجد طلبات مطابقة حالياً. جرّب تغيير الفلاتر أو إضافة طلب
                    جديد.
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

// نفس ألوان الجاهزية المستخدمة في OrderDetails.jsx
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

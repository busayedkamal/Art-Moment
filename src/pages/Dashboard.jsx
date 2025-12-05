// src/pages/Dashboard.jsx
import { useOrdersData } from '../hooks/useOrdersData.js'

export default function Dashboard() {
  const { orders, loading, error, reload } = useOrdersData()

  const totalOrders = orders.length
  const newOrders = orders.filter((o) => o.status === 'جديد').length
  const readyOrders = orders.filter((o) => o.status === 'جاهز').length
  const inProgressOrders = orders.filter(
    (o) => o.status === 'قيد الطباعة',
  ).length
  const deliveredOrders = orders.filter(
    (o) => o.status === 'تم التسليم',
  ).length

  const lateOrders = orders.filter(isLateOrder).length

  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  const totalPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0)
  const totalUnpaid = totalAmount - totalPaid

  const latestOrders = [...orders].slice(-5).reverse()

  return (
    <div className="space-y-6">
      {/* العنوان + حالة التحميل / الخطأ + زر تحديث */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          لوحة تحكم لحظة فن
        </h1>

        <div className="flex items-center gap-2 text-xs">
          {loading && (
            <span className="text-slate-500">
              جاري تحميل الطلبات من الخادم...
            </span>
          )}
          {error && !loading && (
            <span className="text-red-500 max-w-xs text-right">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs hover:bg-slate-50"
          >
            تحديث البيانات
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الطلبات" value={totalOrders} />
        <StatCard label="طلبات جديدة" value={newOrders} />
        <StatCard label="قيد الطباعة" value={inProgressOrders} />
        <StatCard label="طلبات جاهزة" value={readyOrders} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="طلبات متأخرة"
          value={lateOrders}
          variant={lateOrders > 0 ? 'danger' : 'normal'}
        />
        <StatCard label="تم التسليم" value={deliveredOrders} />
        <MoneyCard label="إجمالي المبالغ" value={totalAmount} />
        <MoneyCard label="المبالغ المدفوعة" value={totalPaid} sub={totalUnpaid} />
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-slate-800 text-sm md:text-base mb-2">
          ملخص سريع
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          هذه الأرقام مبنية حالياً على البيانات القادمة من قاعدة البيانات عبر
          واجهة /api/orders (مع الحفاظ على نسخة احتياطية محلية داخل المتصفح).
          <br />
          يمكنك إضافة وتعديل الطلبات من صفحة الطلبات، وستنعكس التغييرات هنا.
        </p>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 text-sm md:text-base mb-3">
          أحدث الطلبات
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-right">رقم الطلب</th>
                <th className="text-right">العميل</th>
                <th className="text-right">الحالة</th>
                <th className="text-right">الدفع</th>
                <th className="text-right">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-[11px]">{o.id}</td>
                  <td>{o.customerName}</td>
                  <td>{o.status}</td>
                  <td className="text-xs text-slate-600">{o.paymentStatus}</td>
                  <td className="text-xs">
                    {Number(o.totalAmount || 0).toFixed(2)} ر.س
                  </td>
                </tr>
              ))}

              {latestOrders.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا يوجد طلبات حتى الآن.
                  </td>
                </tr>
              )}

              {latestOrders.length === 0 && loading && (
                <tr>
                  <td
                    colSpan={5}
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

function StatCard({ label, value, variant = 'normal' }) {
  const color =
    variant === 'danger'
      ? 'bg-red-50 border-red-100 text-red-700'
      : 'bg-white border-slate-200 text-slate-800'

  return (
    <div className={`rounded-2xl shadow-sm border p-3 md:p-4 ${color}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold">{value}</div>
    </div>
  )
}

function MoneyCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl shadow-sm border bg-white border-slate-200 p-3 md:p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold mb-1">
        {Number(value || 0).toFixed(2)} ر.س
      </div>
      {typeof sub === 'number' && (
        <div className="text-[11px] text-slate-500">
          المتبقي على العملاء: {Number(sub || 0).toFixed(2)} ر.س
        </div>
      )}
    </div>
  )
}

function isLateOrder(order) {
  if (!order.dueDate) return false
  try {
    const due = new Date(order.dueDate)
    const today = new Date()
    return (
      due < today &&
      order.status !== 'تم التسليم' &&
      order.status !== 'ملغي'
    )
  } catch {
    return false
  }
}

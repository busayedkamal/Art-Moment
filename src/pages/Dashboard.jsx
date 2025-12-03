// src/pages/Dashboard.jsx
import { loadOrders } from '../storage/orderStorage.js'
import { StatusBadge, PaymentBadge } from '../components/StatusBadges.jsx'

export default function Dashboard() {
  const orders = loadOrders() || []

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

  const totalAmount = orders.reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0,
  )
  const totalPaid = orders.reduce(
    (sum, o) => sum + (o.paidAmount || 0),
    0,
  )
  const totalUnpaid = totalAmount - totalPaid

  const latestOrders = [...orders].slice(-5).reverse()

  return (
    <div className="space-y-6">
      {/* عنوان الصفحة بهوية موحدة */}
      <h1 className="heading-main">لوحة تحكم لحظة فن</h1>

      {/* كروت الإحصائيات العامة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الطلبات" value={totalOrders} />
        <StatCard label="طلبات جديدة" value={newOrders} />
        <StatCard label="قيد الطباعة" value={inProgressOrders} />
        <StatCard label="طلبات جاهزة" value={readyOrders} />
      </div>

      {/* كروت الحالات المالية والمتأخرة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="طلبات متأخرة"
          value={lateOrders}
          variant={lateOrders > 0 ? 'danger' : 'normal'}
        />
        <StatCard label="تم التسليم" value={deliveredOrders} />
        <MoneyCard label="إجمالي المبالغ" value={totalAmount} />
        <MoneyCard
          label="المبالغ المدفوعة"
          value={totalPaid}
          sub={totalUnpaid}
        />
      </div>

      {/* كرت: ملخص سريع */}
      <div className="card">
        <h2 className="text-sm md:text-base font-semibold text-slate-900 mb-2">
          ملخص سريع
        </h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          هذه الأرقام مبنية حالياً على البيانات المخزنة في المتصفح (LocalStorage).
          <br />
          يمكنك إضافة وتعديل الطلبات من صفحة الطلبات، وستنعكس التغييرات هنا.
        </p>
      </div>

      {/* كرت: أحدث الطلبات */}
      <div className="card">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-3">
          أحدث الطلبات
        </h3>

        {latestOrders.length === 0 ? (
          <p className="text-xs md:text-sm text-slate-500">
            لا توجد طلبات حتى الآن. يمكنك البدء من صفحة "الطلبات" وإضافة أول طلب.
          </p>
        ) : (
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
                    <td className="text-slate-900">{o.customerName}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>
                      <PaymentBadge paymentStatus={o.paymentStatus} />
                    </td>
                    <td className="text-xs text-slate-800">
                      {o.totalAmount} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** كرت إحصائي بسيط */
function StatCard({ label, value, variant = 'normal' }) {
  const colorClasses =
    variant === 'danger'
      ? 'bg-red-50 border-red-100 text-red-700'
      : 'bg-white border-slate-200 text-slate-900'

  return (
    <div className={`card ${colorClasses}`}>
      <div className="text-[11px] md:text-xs text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-xl md:text-2xl font-bold">{value}</div>
    </div>
  )
}

/** كرت مالي */
function MoneyCard({ label, value, sub }) {
  const safeValue = typeof value === 'number' ? value : 0
  const hasSub = typeof sub === 'number'

  return (
    <div className="card">
      <div className="text-[11px] md:text-xs text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-xl md:text-2xl font-bold mb-1 text-emerald-700">
        {safeValue.toFixed(2)} ر.س
      </div>
      {hasSub && (
        <div className="text-[11px] text-slate-500">
          المتبقي على العملاء:{' '}
          <span className="font-semibold text-slate-700">
            {sub.toFixed(2)} ر.س
          </span>
        </div>
      )}
    </div>
  )
}

function isLateOrder(order) {
  if (!order?.dueDate) return false
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

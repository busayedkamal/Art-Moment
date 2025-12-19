// src/pages/Dashboard.jsx
import { loadOrders } from '../storage/orderStorage.js'

export default function Dashboard() {
  // قراءة الطلبات من LocalStorage
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
    (sum, o) => sum + Number(o.totalAmount || 0),
    0,
  )
  const totalPaid = orders.reduce(
    (sum, o) => sum + Number(o.paidAmount || 0),
    0,
  )
  const totalUnpaid = totalAmount - totalPaid

  const latestOrders = [...orders].slice(-5).reverse()

  return (
    <div className="space-y-6">
      {/* العنوان الرئيسي */}
      <h1 className="text-lg md:text-2xl font-bold text-slate-800">
        لوحة تحكم لحظة فن
      </h1>

      {/* كروت أعداد الطلبات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الطلبات" value={totalOrders} />
        <StatCard label="طلبات جديدة" value={newOrders} />
        <StatCard label="قيد الطباعة" value={inProgressOrders} />
        <StatCard label="طلبات جاهزة" value={readyOrders} />
      </div>

      {/* كروت حالة التسليم والمبالغ */}
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

      {/* ملخص نصي سريع */}
      <div className="card p-4">
        <h2 className="font-semibold text-slate-800 text-sm md:text-base mb-2">
          ملخص سريع
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          هذه الأرقام مبنية على البيانات المخزّنة محلياً في متصفحك
          (LocalStorage). يمكنك إضافة وتعديل الطلبات من صفحة الطلبات،
          وستنعكس التغييرات مباشرة هنا في لوحة التحكم عند إعادة فتح الصفحة.
        </p>
      </div>

      {/* جدول أحدث الطلبات */}
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
                  <td>{o.customerName || 'بدون اسم'}</td>
                  <td>{o.status || '-'}</td>
                  <td className="text-xs text-slate-600">
                    {o.paymentStatus || '-'}
                  </td>
                  <td className="text-xs">
                    {Number(o.totalAmount || 0).toFixed(2)} ر.س
                  </td>
                </tr>
              ))}

              {latestOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-slate-400 text-xs"
                  >
                    لا يوجد طلبات حتى الآن. يمكنك البدء من صفحة &quot;الطلبات&quot;
                    وإضافة أول طلب.
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
  const colorClasses =
    variant === 'danger'
      ? 'bg-red-50 border-red-100 text-red-700'
      : 'bg-white border-slate-200 text-slate-800'

  return (
    <div className={`rounded-2xl shadow-sm border p-3 md:p-4 ${colorClasses}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold">{value}</div>
    </div>
  )
}

function MoneyCard({ label, value, sub }) {
  const main = Number(value || 0)
  const subValue = typeof sub === 'number' ? Number(sub || 0) : null

  return (
    <div className="rounded-2xl shadow-sm border bg-white border-slate-200 p-3 md:p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold mb-1">
        {main.toFixed(2)} ر.س
      </div>
      {subValue !== null && (
        <div className="text-[11px] text-slate-500">
          المتبقي على العملاء: {subValue.toFixed(2)} ر.س
        </div>
      )}
    </div>
  )
}

function isLateOrder(order) {
  if (!order || !order.dueDate) return false
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

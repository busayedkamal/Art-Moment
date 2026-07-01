export const STORE_ORDER_STATUSES = {
  pending_verification: {
    label: 'بانتظار التأكيد',
    description: 'وصل الطلب ونراجعه قبل البدء.',
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  confirmed: {
    label: 'تم التأكيد',
    description: 'تم اعتماد الطلب وتجهيزه للمعالجة.',
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  processing: {
    label: 'قيد التجهيز',
    description: 'يجري تجهيز المنتجات وتغليفها بعناية.',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  ready_for_delivery: {
    label: 'جاهز للتسليم',
    description: 'الطلب جاهز وينتظر التوصيل أو الاستلام.',
    tone: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  shipped: {
    label: 'تم الشحن',
    description: 'تم تسليم الطلب لشركة الشحن.',
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  },
  delivered: {
    label: 'تم التسليم',
    description: 'تم تسليم الطلب بنجاح.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  cancelled: {
    label: 'ملغي',
    description: 'تم إلغاء الطلب.',
    tone: 'bg-red-50 text-red-700 border-red-100',
  },
  returned: {
    label: 'مرتجع',
    description: 'تم تسجيل الطلب كمرتجع.',
    tone: 'bg-orange-50 text-orange-700 border-orange-100',
  },
};

export const STORE_ORDER_STEPS = [
  'pending_verification',
  'confirmed',
  'processing',
  'ready_for_delivery',
  'shipped',
  'delivered',
];

export function getStoreOrderStatus(status) {
  return STORE_ORDER_STATUSES[status] || {
    label: status || 'غير محدد',
    description: 'حالة الطلب قيد التحديث.',
    tone: 'bg-gray-50 text-gray-600 border-gray-100',
  };
}

export function getStoreOrderStepIndex(status) {
  if (status === 'cancelled' || status === 'returned') return -1;
  const index = STORE_ORDER_STEPS.indexOf(status);
  return index === -1 ? 0 : index;
}

export function getPaymentState(order) {
  const total = Number(order?.totalAmount || 0) + Number(order?.deliveryFee || 0);
  const paid = Number(order?.amountPaid || 0);
  if (total > 0 && paid >= total) return { label: 'مدفوع بالكامل', tone: 'bg-emerald-50 text-emerald-700' };
  if (paid > 0) return { label: 'مدفوع جزئياً', tone: 'bg-amber-50 text-amber-700' };
  return { label: 'بانتظار الدفع', tone: 'bg-red-50 text-red-600' };
}

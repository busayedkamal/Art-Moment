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
  const refunded = Number(order?.refundedAmount ?? order?.refunded_amount ?? 0);
  const explicitStatus = order?.paymentStatus || order?.payment_status;

  if (explicitStatus && STORE_PAYMENT_STATUSES[explicitStatus]) {
    return {
      code: explicitStatus,
      ...STORE_PAYMENT_STATUSES[explicitStatus],
    };
  }

  if (total > 0 && refunded >= total) return { code: 'full_refund', ...STORE_PAYMENT_STATUSES.full_refund };
  if (refunded > 0) return { code: 'partial_refund', ...STORE_PAYMENT_STATUSES.partial_refund };
  if (total > 0 && paid >= total) return { code: 'paid', ...STORE_PAYMENT_STATUSES.paid };
  if (paid > 0) return { code: 'awaiting_review', ...STORE_PAYMENT_STATUSES.awaiting_review };
  return { code: 'pending_payment', ...STORE_PAYMENT_STATUSES.pending_payment };
}

export const STORE_PAYMENT_STATUSES = {
  pending_payment: {
    label: 'بانتظار الدفع',
    description: 'لم يتم تسجيل دفعة على الطلب بعد.',
    tone: 'bg-red-50 text-red-600 border-red-100',
  },
  awaiting_review: {
    label: 'بانتظار المراجعة',
    description: 'تم تسجيل دفعة أو تحويل ويحتاج مراجعة الإدارة.',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  paid: {
    label: 'مدفوع',
    description: 'تم تأكيد الدفع لهذا الطلب.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  payment_failed: {
    label: 'فشل الدفع',
    description: 'لم تكتمل محاولة الدفع ويمكن إعادة المحاولة.',
    tone: 'bg-rose-50 text-rose-700 border-rose-100',
  },
  partial_refund: {
    label: 'مسترد جزئياً',
    description: 'تم رد جزء من مبلغ الطلب.',
    tone: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  full_refund: {
    label: 'مسترد بالكامل',
    description: 'تم رد كامل مبلغ الطلب.',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const STORE_PAYMENT_METHODS = {
  bank_transfer: 'تحويل بنكي',
  cash_on_delivery: 'الدفع عند الاستلام',
  card: 'بطاقة دفع',
  wallet: 'محفظة العميل',
  manual: 'تنسيق يدوي',
  other: 'طريقة أخرى',
};

export function getStorePaymentStatus(status) {
  return STORE_PAYMENT_STATUSES[status] || STORE_PAYMENT_STATUSES.pending_payment;
}

export function getStorePaymentMethod(method) {
  return STORE_PAYMENT_METHODS[method || 'bank_transfer'] || STORE_PAYMENT_METHODS.other;
}

export const STORE_RETURN_STATUSES = {
  new_request: {
    label: 'طلب استرجاع جديد',
    description: 'تم استلام طلب الاسترجاع وينتظر مراجعة الإدارة.',
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  under_review: {
    label: 'قيد المراجعة',
    description: 'تراجع الإدارة تفاصيل الطلب والمنتجات المختارة.',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  approved: {
    label: 'مقبول',
    description: 'تم قبول طلب الاسترجاع مبدئياً.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  rejected: {
    label: 'مرفوض',
    description: 'تم رفض طلب الاسترجاع مع توضيح السبب عند توفره.',
    tone: 'bg-red-50 text-red-700 border-red-100',
  },
  awaiting_item: {
    label: 'بانتظار استلام المنتج',
    description: 'ينتظر الفريق استلام المنتج المرتجع أو تأكيد حالته.',
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  },
  item_received: {
    label: 'تم الاستلام',
    description: 'تم استلام المنتج المرتجع وجاري إنهاء المعالجة المالية.',
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  refunded: {
    label: 'تم رد المبلغ',
    description: 'تم ربط طلب الاسترجاع بسجل الاسترداد المالي.',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const STORE_RETURN_TRANSITIONS = {
  new_request: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['awaiting_item', 'item_received', 'refunded'],
  awaiting_item: ['item_received', 'rejected'],
  item_received: ['refunded'],
  rejected: ['under_review'],
  refunded: [],
};

export function getStoreReturnStatus(status) {
  return STORE_RETURN_STATUSES[status] || STORE_RETURN_STATUSES.new_request;
}

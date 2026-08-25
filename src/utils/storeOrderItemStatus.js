export const PRODUCT_ITEM_STATUSES = {
  pending: { label: 'تم استلام المنتج', description: 'تم تسجيل المنتج ضمن الطلب.', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
  reserved: { label: 'تم حجز المنتج', description: 'حُجزت الكمية المطلوبة من المخزون.', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  preparing: { label: 'قيد التجهيز', description: 'يجري تجهيز المنتج وتغليفه.', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  ready: { label: 'جاهز', description: 'أصبح المنتج جاهزاً مع بقية الطلب.', tone: 'bg-teal-50 text-teal-700 border-teal-100' },
  fulfilled: { label: 'مكتمل', description: 'اكتمل تنفيذ هذا المنتج.', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  attention_required: { label: 'يحتاج متابعة', description: 'سيتواصل معك فريق لحظة فن عند الحاجة.', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  cancelled: { label: 'ملغي', description: 'أُلغي هذا المنتج من الطلب.', tone: 'bg-red-50 text-red-700 border-red-100' },
};

export const PRINT_ITEM_STATUSES = {
  files_received: { label: 'تم استلام الصور', description: 'استلمنا ملفات الطباعة بأمان.', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  queued: { label: 'في قائمة الطباعة', description: 'أضيفت الصور إلى قائمة التنفيذ.', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  printing: { label: 'قيد الطباعة', description: 'يجري تنفيذ صورك الآن.', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  printed: { label: 'اكتملت الطباعة', description: 'اكتملت الطباعة وتنتظر التجهيز النهائي.', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  ready: { label: 'جاهزة', description: 'صورك المطبوعة جاهزة مع بقية الطلب.', tone: 'bg-teal-50 text-teal-700 border-teal-100' },
  attention_required: { label: 'تحتاج مراجعة', description: 'تحتاج بعض تفاصيل الطباعة إلى متابعة.', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  cancelled: { label: 'ملغاة', description: 'أُلغي عنصر الطباعة من الطلب.', tone: 'bg-red-50 text-red-700 border-red-100' },
};

export const PRODUCT_ITEM_TRANSITIONS = {
  pending: ['reserved', 'preparing', 'attention_required', 'cancelled'],
  reserved: ['preparing', 'ready', 'attention_required', 'cancelled'],
  preparing: ['ready', 'attention_required', 'cancelled'],
  ready: ['fulfilled', 'attention_required', 'cancelled'],
  fulfilled: [],
  attention_required: ['pending', 'reserved', 'preparing', 'ready', 'cancelled'],
  cancelled: ['pending'],
};

export const PRINT_ITEM_TRANSITIONS = {
  files_received: ['queued', 'printing', 'attention_required', 'cancelled'],
  queued: ['printing', 'attention_required', 'cancelled'],
  printing: ['printed', 'ready', 'attention_required', 'cancelled'],
  printed: ['ready', 'attention_required', 'cancelled'],
  ready: ['attention_required', 'cancelled'],
  attention_required: ['files_received', 'queued', 'printing', 'printed', 'ready', 'cancelled'],
  cancelled: ['files_received'],
};

export function getStoreOrderItemTransitions(status, itemType = 'product') {
  const transitions = itemType === 'print' ? PRINT_ITEM_TRANSITIONS : PRODUCT_ITEM_TRANSITIONS;
  return transitions[status] || [];
}
export function getStoreOrderItemStatus(status, itemType = 'product') {
  const statuses = itemType === 'print' ? PRINT_ITEM_STATUSES : PRODUCT_ITEM_STATUSES;
  const fallbackStatus = itemType === 'print' ? 'files_received' : 'pending';
  return statuses[status] || statuses[fallbackStatus];
}

export function summarizeMixedOrderItems(items = []) {
  const printItems = items.filter((item) => item.itemType === 'print');
  const productItems = items.filter((item) => item.itemType !== 'print');
  const parts = [];

  if (printItems.length > 0) parts.push(printItems.length === 1 ? 'طباعة صور' : `${printItems.length} طلبات طباعة`);
  if (productItems.length > 0) parts.push(productItems.length === 1 ? 'منتج واحد' : `${productItems.length} منتجات`);

  return parts.join(' + ') || 'تفاصيل الطلب';
}
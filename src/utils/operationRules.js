export const DEFAULT_OPERATION_RULES = Object.freeze({
  lowStockThreshold: 3,
  paymentOverdueHours: 24,
  trackingDueHours: 24,
  returnReviewDueHours: 48,
  returnWindowDays: 7,
  notificationRetryLimit: 3,
  overdueTasksUrgent: true,
});

const RULE_LIMITS = {
  lowStockThreshold: [0, 100000],
  paymentOverdueHours: [1, 720],
  trackingDueHours: [1, 720],
  returnReviewDueHours: [1, 720],
  returnWindowDays: [1, 365],
  notificationRetryLimit: [0, 10],
};

function clampInteger(value, fallback, [min, max]) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeOperationRules(row = {}) {
  return {
    lowStockThreshold: clampInteger(
      row.lowStockThreshold ?? row.low_stock_threshold,
      DEFAULT_OPERATION_RULES.lowStockThreshold,
      RULE_LIMITS.lowStockThreshold,
    ),
    paymentOverdueHours: clampInteger(
      row.paymentOverdueHours ?? row.payment_overdue_hours,
      DEFAULT_OPERATION_RULES.paymentOverdueHours,
      RULE_LIMITS.paymentOverdueHours,
    ),
    trackingDueHours: clampInteger(
      row.trackingDueHours ?? row.tracking_due_hours,
      DEFAULT_OPERATION_RULES.trackingDueHours,
      RULE_LIMITS.trackingDueHours,
    ),
    returnReviewDueHours: clampInteger(
      row.returnReviewDueHours ?? row.return_review_due_hours,
      DEFAULT_OPERATION_RULES.returnReviewDueHours,
      RULE_LIMITS.returnReviewDueHours,
    ),
    returnWindowDays: clampInteger(
      row.returnWindowDays ?? row.return_window_days,
      DEFAULT_OPERATION_RULES.returnWindowDays,
      RULE_LIMITS.returnWindowDays,
    ),
    notificationRetryLimit: clampInteger(
      row.notificationRetryLimit ?? row.notification_retry_limit,
      DEFAULT_OPERATION_RULES.notificationRetryLimit,
      RULE_LIMITS.notificationRetryLimit,
    ),
    overdueTasksUrgent: (row.overdueTasksUrgent ?? row.overdue_tasks_urgent)
      ?? DEFAULT_OPERATION_RULES.overdueTasksUrgent,
  };
}

export function getOperationRulesPayload(rules) {
  const normalized = normalizeOperationRules(rules);
  return {
    low_stock_threshold: normalized.lowStockThreshold,
    payment_overdue_hours: normalized.paymentOverdueHours,
    tracking_due_hours: normalized.trackingDueHours,
    return_review_due_hours: normalized.returnReviewDueHours,
    return_window_days: normalized.returnWindowDays,
    notification_retry_limit: normalized.notificationRetryLimit,
    overdue_tasks_urgent: Boolean(normalized.overdueTasksUrgent),
  };
}

function formatHours(hours) {
  const safeHours = Math.max(0, Math.round(Number(hours || 0) * 1000) / 1000);
  if (safeHours < 1) return 'أقل من ساعة';
  if (safeHours < 24) return `${Math.ceil(safeHours)} س`;
  return `${Math.ceil(safeHours / 24)} يوم`;
}

export function getDeadlineState(timestamp, allowedHours, now = Date.now()) {
  const startedAt = timestamp ? new Date(timestamp).getTime() : Number.NaN;
  if (!Number.isFinite(startedAt)) {
    return { isOverdue: false, elapsedHours: 0, remainingHours: allowedHours, label: 'بدون تاريخ' };
  }

  const elapsedHours = Math.max(0, (now - startedAt) / 3600000);
  const remainingHours = Number(allowedHours || 0) - elapsedHours;
  const isOverdue = remainingHours < 0;

  return {
    isOverdue,
    elapsedHours,
    remainingHours,
    label: isOverdue
      ? `متجاوزة بـ ${formatHours(Math.abs(remainingHours))}`
      : `متبقي ${formatHours(remainingHours)}`,
  };
}

export function getNotificationRetryCount(metadata) {
  return clampInteger(metadata?.retryCount ?? metadata?.retry_count, 0, [0, 1000]);
}

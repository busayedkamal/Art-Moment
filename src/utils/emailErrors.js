const EMAIL_ERROR_MESSAGES = {
  email_api_key_missing: 'مفتاح Resend غير محفوظ في إعدادات الدوال.',
  email_api_key_invalid: 'مفتاح Resend غير صالح أو تم إلغاؤه.',
  email_sender_domain_not_verified: 'نطاق المرسل غير موثّق في Resend. وثّقي art-moment.com ثم أعيدي الإرسال.',
  email_testing_recipient_restricted: 'مرسل Resend التجريبي يسمح بالإرسال إلى بريد مالك الحساب فقط. يلزم توثيق art-moment.com للإرسال للعملاء.',
  email_sender_invalid: 'عنوان المرسل غير صالح. استخدمي عنواناً من نطاق art-moment.com الموثّق.',
  email_rate_limited: 'تم تجاوز حد الإرسال المؤقت في Resend. حاولي مرة أخرى بعد قليل.',
  email_validation_failed: 'رفض Resend بيانات الرسالة. راجعي عنوان المرسل والبريد المستلم.',
  email_send_failed: 'رفض Resend إرسال الرسالة. راجعي نطاق المرسل في إعدادات Resend.',
  notification_retry_limit_reached: 'بلغت الرسالة الحد الأقصى لمحاولات إعادة الإرسال.',
  invalid_notification_retry: 'هذه الرسالة لم تعد متاحة لإعادة الإرسال. حدّثي السجل وحاولي من المحاولة الأحدث.',
};

export function getEmailErrorMessage(errorCode) {
  const value = String(errorCode || '').trim();
  if (!value) return 'تعذر إرسال البريد الإلكتروني.';
  if (EMAIL_ERROR_MESSAGES[value]) return EMAIL_ERROR_MESSAGES[value];
  if (/domain.+not verified|not verified.+domain/i.test(value)) {
    return EMAIL_ERROR_MESSAGES.email_sender_domain_not_verified;
  }
  if (/only send testing emails to your own/i.test(value)) {
    return EMAIL_ERROR_MESSAGES.email_testing_recipient_restricted;
  }
  return value;
}

export function isEmailConfigurationError(errorCode) {
  return [
    'email_api_key_missing',
    'email_api_key_invalid',
    'email_sender_domain_not_verified',
    'email_testing_recipient_restricted',
    'email_sender_invalid',
    'email_validation_failed',
    'email_send_failed',
  ].includes(String(errorCode || '').trim());
}

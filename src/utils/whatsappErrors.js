const WHATSAPP_ERROR_MESSAGES = {
  meta_phone_number_id_missing: 'معرّف رقم الهاتف في Meta غير محفوظ. افتح الإعدادات وأدخل Phone Number ID ثم اختبر الاتصال.',
  meta_phone_number_id_required: 'لا يمكن تفعيل واتساب قبل إدخال Phone Number ID.',
  meta_access_token_missing: 'رمز وصول Meta غير محفوظ في أسرار Supabase.',
  invalid_whatsapp_phone: 'رقم جوال العميل غير صالح للإرسال عبر واتساب.',
  whatsapp_disabled: 'إرسال واتساب متوقف من الإعدادات.',
};

export function getWhatsAppErrorMessage(errorCode) {
  const value = String(errorCode || '').trim();
  if (!value) return 'تعذر إرسال رسالة واتساب.';
  if (WHATSAPP_ERROR_MESSAGES[value]) return WHATSAPP_ERROR_MESSAGES[value];
  if (value.startsWith('meta_whatsapp_error:')) {
    return `رفضت Meta الرسالة: ${value.slice('meta_whatsapp_error:'.length)}`;
  }
  return value;
}

export function isWhatsAppConfigurationError(errorCode) {
  return [
    'meta_phone_number_id_missing',
    'meta_phone_number_id_required',
    'meta_access_token_missing',
    'whatsapp_disabled',
  ].includes(String(errorCode || '').trim());
}
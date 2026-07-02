-- Admin-managed customer message templates.
-- Templates give the team consistent language for order, payment, shipping, return, password, and marketing messages.

create table if not exists public.customer_message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  category text not null default 'general',
  channel text not null default 'email',
  subject text,
  body text not null,
  variables text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_message_templates_channel_check'
  ) then
    alter table public.customer_message_templates
      add constraint customer_message_templates_channel_check
      check (channel in ('email', 'whatsapp', 'sms', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_message_templates_category_check'
  ) then
    alter table public.customer_message_templates
      add constraint customer_message_templates_category_check
      check (category in ('order', 'payment', 'shipping', 'return', 'account', 'marketing', 'general'));
  end if;
end $$;

create or replace function public.touch_customer_message_template_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_customer_message_template_updated_at on public.customer_message_templates;
create trigger touch_customer_message_template_updated_at
before update on public.customer_message_templates
for each row
execute function public.touch_customer_message_template_updated_at();

create index if not exists customer_message_templates_category_idx
on public.customer_message_templates (category, is_active);

alter table public.customer_message_templates enable row level security;

revoke all on public.customer_message_templates from anon, authenticated;
grant all on public.customer_message_templates to authenticated;

drop policy if exists customer_message_templates_admin_all on public.customer_message_templates;
create policy customer_message_templates_admin_all
on public.customer_message_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.customer_message_templates
  (template_key, name, category, channel, subject, body, variables)
values
  (
    'store_order_confirmation',
    'تأكيد طلب متجر',
    'order',
    'email',
    'تم استلام طلبك #{order_number} - لحظة فن',
    'مرحباً {customer_name}،

تم استلام طلبك من متجر لحظة فن بنجاح.
رقم الطلب: #{order_number}
الإجمالي: {total_amount} ريال

سنراجع الطلب ونحدث حالته خطوة بخطوة.',
    array['customer_name', 'order_number', 'total_amount']
  ),
  (
    'payment_reminder',
    'تذكير بالدفع',
    'payment',
    'email',
    'طلبك #{order_number} بانتظار الدفع',
    'مرحباً {customer_name}،

طلبك رقم #{order_number} بانتظار الدفع.
المبلغ المطلوب: {remaining_amount} ريال
طريقة الدفع: {payment_method}

بعد الدفع سيتم تحديث الحالة من لوحة الطلبات.',
    array['customer_name', 'order_number', 'remaining_amount', 'payment_method']
  ),
  (
    'payment_received',
    'تأكيد استلام الدفع',
    'payment',
    'email',
    'تم تأكيد الدفع لطلبك #{order_number}',
    'مرحباً {customer_name}،

تم تأكيد الدفع لطلبك رقم #{order_number}.
المبلغ المدفوع: {paid_amount} ريال

سنبدأ بتجهيز الطلب قريباً.',
    array['customer_name', 'order_number', 'paid_amount']
  ),
  (
    'shipping_update',
    'إشعار الشحن',
    'shipping',
    'email',
    'تم شحن طلبك #{order_number}',
    'مرحباً {customer_name}،

تم شحن طلبك رقم #{order_number}.
شركة الشحن: {courier_name}
رقم التتبع: {tracking_number}

يمكنك متابعة الطلب من صفحة طلباتي.',
    array['customer_name', 'order_number', 'courier_name', 'tracking_number']
  ),
  (
    'return_status_update',
    'تحديث الاسترجاع',
    'return',
    'email',
    'تحديث طلب الاسترجاع #{return_number}',
    'مرحباً {customer_name}،

تم تحديث طلب الاسترجاع رقم #{return_number}.
الحالة الحالية: {return_status}

ملاحظة الإدارة:
{admin_note}',
    array['customer_name', 'return_number', 'return_status', 'admin_note']
  ),
  (
    'password_reset',
    'استعادة كلمة المرور',
    'account',
    'email',
    'رمز استعادة كلمة المرور - لحظة فن',
    'مرحباً {customer_name}،

رمز استعادة كلمة المرور الخاص بك:
{reset_code}

ينتهي الرمز خلال {expires_minutes} دقيقة. إذا لم تطلبي هذا الإجراء، تجاهلي الرسالة.',
    array['customer_name', 'reset_code', 'expires_minutes']
  ),
  (
    'marketing_offer',
    'عرض تسويقي',
    'marketing',
    'email',
    'عرض خاص من لحظة فن',
    'لدينا عرض جديد يناسب ذكرياتك الجميلة.

{offer_details}

يسعدنا خدمتك دائماً.',
    array['customer_name', 'offer_details']
  )
on conflict (template_key) do nothing;

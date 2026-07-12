-- Configurable operational rules for the admin task center and customer flows.

begin;

alter table public.settings
  add column if not exists low_stock_threshold integer not null default 3,
  add column if not exists payment_overdue_hours integer not null default 24,
  add column if not exists tracking_due_hours integer not null default 24,
  add column if not exists return_review_due_hours integer not null default 48,
  add column if not exists return_window_days integer not null default 7,
  add column if not exists notification_retry_limit integer not null default 3,
  add column if not exists overdue_tasks_urgent boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_low_stock_threshold_check') then
    alter table public.settings add constraint settings_low_stock_threshold_check
      check (low_stock_threshold between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_payment_overdue_hours_check') then
    alter table public.settings add constraint settings_payment_overdue_hours_check
      check (payment_overdue_hours between 1 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_tracking_due_hours_check') then
    alter table public.settings add constraint settings_tracking_due_hours_check
      check (tracking_due_hours between 1 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_return_review_due_hours_check') then
    alter table public.settings add constraint settings_return_review_due_hours_check
      check (return_review_due_hours between 1 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_return_window_days_check') then
    alter table public.settings add constraint settings_return_window_days_check
      check (return_window_days between 1 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_notification_retry_limit_check') then
    alter table public.settings add constraint settings_notification_retry_limit_check
      check (notification_retry_limit between 0 and 10);
  end if;
end $$;

comment on column public.settings.low_stock_threshold is 'Store product quantity that creates a low-stock admin task.';
comment on column public.settings.payment_overdue_hours is 'Hours before a pending store payment becomes overdue.';
comment on column public.settings.tracking_due_hours is 'Hours allowed to add shipping and tracking details.';
comment on column public.settings.return_review_due_hours is 'Hours allowed to review an open return request.';
comment on column public.settings.return_window_days is 'Maximum days in which a customer may request a return.';
comment on column public.settings.notification_retry_limit is 'Maximum manual retries for a failed customer notification.';
comment on column public.settings.overdue_tasks_urgent is 'Promote overdue operational tasks to high priority.';

commit;

# Art Moment Security Deployment

## Order of operations

1. Deploy the Edge Functions:

```bash
supabase functions deploy public-settings
supabase functions deploy customer-auth
supabase functions deploy customer-orders
supabase functions deploy store-coupons
supabase functions deploy store-checkout
supabase functions deploy track-order
supabase functions deploy store-return-requests
supabase functions deploy customer-account
supabase functions deploy customer-marketing
```

2. Set secrets for server-side email and WhatsApp sending:

```bash
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM="Art Moment <notifications@art-moment.com>"
supabase secrets set RESEND_REPLY_TO=art.moment26@gmail.com
supabase secrets set CUSTOMER_SESSION_SECRET=your-long-random-secret
supabase secrets set RETURN_REQUEST_NOTIFY_EMAIL=admin@example.com
supabase secrets set PUBLIC_SITE_URL=https://art-moment.com
supabase secrets set WHATSAPP_ENABLED=true
supabase secrets set ULTRAMSG_INSTANCE_ID=your-instance-id
supabase secrets set ULTRAMSG_TOKEN=your-token
```

Before setting `RESEND_FROM`, add `art-moment.com` (or a sending subdomain such as
`notifications.art-moment.com`) in Resend and complete its SPF and DKIM verification.
Resend does not allow a Gmail address in the `from` field. The project Gmail address
is kept in `RESEND_REPLY_TO` and as the administration notification recipient.

The fallback sender `onboarding@resend.dev` is only for testing and can send to the
email address that owns the Resend account. It cannot send production messages to customers.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available to the functions. If they are not already present in the project, add them as Supabase secrets before deploying.

3. Apply the RLS migration from Supabase SQL Editor:

```text
supabase/migrations/202606300001_secure_public_access.sql
```

If the first migration was already applied before the product catalog patch, also run:

```text
supabase/migrations/202606300002_public_products_catalog.sql
```

For customer password recovery and marketing preferences, also run:

```text
supabase/migrations/202607010001_customer_account_recovery.sql
```

For store customer links and payment statuses, also run:

```text
supabase/migrations/202607010002_store_orders_customer_link.sql
supabase/migrations/202607010003_store_payment_statuses.sql
```

For return and refund requests, also run:

```text
supabase/migrations/202607020001_store_return_requests.sql
```

For customer account profile fields, saved addresses, and contact preferences, also run:

```text
supabase/migrations/202607020002_customer_account_profile.sql
```

For admin CRM notes, manual customer status, and marketing/support filters, also run:

```text
supabase/migrations/202607020003_customer_admin_crm.sql
```

For store cart coupons and discount receipts, also run:

```text
supabase/migrations/202607020004_store_order_coupons.sql
```

For atomic stock reservation during checkout and admin cancellation/reopen flows, also run:

```text
supabase/migrations/202607030001_store_stock_reservation.sql
```

For customer data deletion request review metadata, also run:

```text
supabase/migrations/202607030002_customer_data_deletion_review.sql
```

For marketing unsubscribe links and customer message logs, also run:

```text
supabase/migrations/202607030003_customer_marketing_compliance.sql
```

For admin-managed customer message templates, also run:

```text
supabase/migrations/202607030004_customer_message_templates.sql
```

For the admin audit trail, also run:

```text
supabase/migrations/202607030005_admin_activity_logs.sql
```

For configurable operational deadlines, stock alerts, return windows, and notification retries, also run:

```text
supabase/migrations/202607120001_operation_rules.sql
```

4. Confirm these public flows still work:

- Landing page pricing loads.
- Customer signup/login works.
- Customer password recovery sends a Resend email and accepts the reset code.
- Customer store orders page loads only after customer login.
- Customer account page loads only after customer login and can update profile data.
- Customer account can request data deletion, and admin customers page can mark the request reviewed.
- Admin customers page shows store account profiles, marketing consent, return flags, and CRM status.
- Admin customers page can send Resend campaigns only to opted-in customers with email.
- Marketing campaign emails include a working unsubscribe link.
- Admin settings page can manage customer message templates and campaigns can use active marketing templates.
- Store cart validates coupons through Edge Functions and checkout stores the discount on the order.
- Store checkout creates an order and deducts the ordered quantities from product stock.
- Cancelling a store order from admin restores stock; reopening a cancelled order reserves stock again.
- Tracking by short order id works.
- Tracking by phone + PIN works.

5. After confirming admin access, add at least one admin row:

```sql
insert into public.admin_users (email)
values ('admin@example.com')
on conflict (email) do nothing;
```

When `admin_users` is empty, any Supabase Auth user can use admin policies as a bootstrap fallback. Once at least one row exists, access is limited to matching `user_id` or `email`.

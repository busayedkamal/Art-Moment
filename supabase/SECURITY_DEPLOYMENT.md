# Art Moment Security Deployment

## Order of operations

1. Deploy the Edge Functions:

```bash
supabase functions deploy public-settings
supabase functions deploy customer-auth
supabase functions deploy customer-orders
supabase functions deploy store-checkout
supabase functions deploy track-order
supabase functions deploy store-return-requests
```

2. Set secrets for server-side email and WhatsApp sending:

```bash
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM="Art Moment <hello@your-domain.com>"
supabase secrets set CUSTOMER_SESSION_SECRET=your-long-random-secret
supabase secrets set RETURN_REQUEST_NOTIFY_EMAIL=admin@example.com
supabase secrets set WHATSAPP_ENABLED=true
supabase secrets set ULTRAMSG_INSTANCE_ID=your-instance-id
supabase secrets set ULTRAMSG_TOKEN=your-token
```

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

4. Confirm these public flows still work:

- Landing page pricing loads.
- Customer signup/login works.
- Customer password recovery sends a Resend email and accepts the reset code.
- Customer store orders page loads only after customer login.
- Store checkout creates an order.
- Tracking by short order id works.
- Tracking by phone + PIN works.

5. After confirming admin access, add at least one admin row:

```sql
insert into public.admin_users (email)
values ('admin@example.com')
on conflict (email) do nothing;
```

When `admin_users` is empty, any Supabase Auth user can use admin policies as a bootstrap fallback. Once at least one row exists, access is limited to matching `user_id` or `email`.

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
supabase functions deploy telegram-bot --no-verify-jwt
```

2. Set secrets for server-side email and WhatsApp sending:

```bash
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM="Art Moment <notifications@art-moment.com>"
supabase secrets set RESEND_REPLY_TO=art.moment26@gmail.com
supabase secrets set CUSTOMER_SESSION_SECRET=your-long-random-secret
supabase secrets set RETURN_REQUEST_NOTIFY_EMAIL=art.moment26@gmail.com
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

For explicit print-order discounts, points payments, coupon attribution, and historical unit-price snapshots, also run:

```text
supabase/migrations/202607130001_order_financial_breakdown.sql
```

For the Telegram administration bot chat registry and webhook deduplication, also run:

```text
supabase/migrations/202607190001_telegram_bot.sql
```

For the unified reward-points ledger, four-month expiry, redemption limits, signup bonus,
refund reconciliation, and separate non-reward store credit, run:

```text
supabase/migrations/202607190002_reward_points_program.sql
```

After this migration, redeploy the functions that read or change rewards:

```bash
supabase functions deploy customer-account
supabase functions deploy customer-orders
supabase functions deploy store-checkout
supabase functions deploy store-return-requests
supabase functions deploy track-order
```

The default policy is 2 points per eligible paid SAR, 100 points = 1 SAR,
a 500-point redemption minimum, a 25% per-order maximum, and expiry after 4 months.
Each earned lot expires independently; package credit and store credit do not use this expiry.

If the initial reward migration was already applied, run the reward hardening migration next:

```text
supabase/migrations/202607220001_reward_points_program_hardening.sql
```

It ties earning to actual payment coverage, reconciles mixed cash/points refunds,
records restored points, validates the first completed purchase bonus, and preserves
all legacy package transaction types. Redeploy these functions afterward:

```bash
supabase functions deploy customer-orders
supabase functions deploy store-return-requests
```

For automatic reward expiry reminders, detailed reward lots, and secure customer
redemption on unpaid store orders, run:

```text
supabase/migrations/202607220002_reward_expiry_notifications.sql
```

Deploy the updated reward readers and the reminder function:

```bash
supabase functions deploy customer-account
supabase functions deploy customer-orders
supabase functions deploy track-order
supabase functions deploy reward-expiry-notifications --no-verify-jwt
```

Create a strong random cron secret, save the same value in Edge Function Secrets,
and add the function URL and secret to Vault. Never commit the secret:

```powershell
$ProjectRef = "dftmbamuyupgzpqfoixl"
$RewardCronSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
npx supabase secrets set "REWARD_CRON_SECRET=$RewardCronSecret" --project-ref $ProjectRef
```

Then run the following in the Supabase SQL Editor, replacing the placeholder once:

```sql
select vault.create_secret(
  'https://dftmbamuyupgzpqfoixl.supabase.co/functions/v1/reward-expiry-notifications',
  'reward_expiry_function_url'
);
select vault.create_secret('REPLACE_WITH_THE_SAME_CRON_SECRET', 'reward_expiry_cron_secret');
select public.schedule_reward_expiry_notifications();
```

The daily schedule runs at 07:00 Asia/Riyadh and sends idempotent reminders at
30 and 7 days. Manual reminders remain available from the Customers page and are
recorded in both the customer message log and the administration activity log.

## Private print-file cleanup

Run the privacy lifecycle and product-details migrations in the SQL Editor:

```text
supabase/migrations/202608120001_print_privacy_retention.sql
supabase/migrations/202608120002_product_decision_details.sql
```

Deploy the cleanup endpoint and store a long random secret. The same value is
used by the scheduled request and must never be committed:

```powershell
$ProjectRef = "dftmbamuyupgzpqfoixl"
$PrintCleanupSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
npx supabase secrets set "PRINT_FILE_CLEANUP_SECRET=$PrintCleanupSecret" --project-ref $ProjectRef
npx supabase functions deploy print-file-cleanup --no-verify-jwt --project-ref $ProjectRef
```

Then add the function URL and the same secret to Vault in the SQL Editor. Replace
the placeholder with the value generated above:

```sql
select vault.create_secret(
  'https://dftmbamuyupgzpqfoixl.supabase.co/functions/v1/print-file-cleanup',
  'print_cleanup_function_url'
);
select vault.create_secret('REPLACE_WITH_THE_SAME_SECRET', 'print_cleanup_cron_secret');
select public.schedule_print_file_cleanup();
```

The job runs daily at 04:30 Asia/Riyadh. It permanently removes originals and
previews for unfinished drafts after the configured draft period, and for terminal
orders after the configured post-order period. Only deletion metadata is retained.

## Mixed cart and guest checkout

Run the mixed-cart migration in the SQL Editor:

```text
supabase/migrations/202608130001_mixed_cart_checkout.sql
```

Then deploy the functions that validate print snapshots, product availability,
coupon scope, and the final server-side total:

```powershell
$ProjectRef = "dftmbamuyupgzpqfoixl"
npx supabase functions deploy print-builder --no-verify-jwt --project-ref $ProjectRef
npx supabase functions deploy store-coupons --project-ref $ProjectRef
npx supabase functions deploy store-checkout --project-ref $ProjectRef
```

Guest checkout creates an unclaimed customer record only when both the phone and
email are new. Exact existing identities can receive the new order, but conflicting
phone/email pairs require sign-in. Reward-point redemption always requires an
authenticated customer session. Checkout idempotency prevents repeated clicks from
creating duplicate orders.

## Telegram bot setup

The bot token must never be committed or placed in a Vite environment variable. Store it only in Supabase Secrets. The webhook secret may contain letters, numbers, `_`, and `-`.

PowerShell setup without writing the token into the repository:

```powershell
$BotToken = (Read-Host "Telegram bot token from BotFather").Trim()
$WebhookSecret = [guid]::NewGuid().ToString("N")
$ProjectRef = "dftmbamuyupgzpqfoixl"

if ([string]::IsNullOrWhiteSpace($BotToken)) {
  throw "Telegram bot token is empty. Run the BotToken assignment again."
}
if ($BotToken -notmatch '^\d+:[A-Za-z0-9_-]+$') {
  throw "Telegram bot token format is invalid. Copy the full token from BotFather without the word bot."
}

# Telegram must recognize the token before any secret or webhook is saved.
$BotInfo = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$BotToken/getMe"
if (-not $BotInfo.ok) {
  throw "Telegram rejected the bot token. Create or copy a fresh token from BotFather."
}
Write-Host "Telegram token verified for @$($BotInfo.result.username)"

npx supabase secrets set "TELEGRAM_BOT_TOKEN=$BotToken" "TELEGRAM_WEBHOOK_SECRET=$WebhookSecret" --project-ref $ProjectRef
npx supabase functions deploy telegram-bot --no-verify-jwt --project-ref $ProjectRef

$WebhookUrl = "https://$ProjectRef.supabase.co/functions/v1/telegram-bot"
$Body = @{
  url = $WebhookUrl
  secret_token = $WebhookSecret
  allowed_updates = @("message")
  drop_pending_updates = $true
} | ConvertTo-Json

$WebhookResult = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BotToken/setWebhook" -ContentType "application/json" -Body $Body
$WebhookResult
Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$BotToken/getWebhookInfo"
```

Send `/start` to the bot. It returns the Telegram chat id without exposing database data. Activate that single administration chat:

```powershell
npx supabase secrets set "TELEGRAM_ADMIN_CHAT_ID=the-chat-id-returned-by-start" --project-ref $ProjectRef
```

Then use `/status` for the operational summary, `/orders` for recent print and store orders, and `/help` for the command list. Other chat ids remain registered but cannot read project data unless explicitly activated in `telegram_bot_chats`.

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

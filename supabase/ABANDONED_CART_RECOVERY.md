# Abandoned Cart Recovery

The `abandoned-cart` Edge Function stores a cart only when the customer:

- is signed in;
- has a valid customer session;
- has an email address;
- explicitly accepted marketing messages.

It sends one reminder after two hours and never sends to customers who did not opt in.

## Deploy

```powershell
npx supabase functions deploy abandoned-cart --no-verify-jwt --project-ref YOUR_PROJECT_REF
npx supabase secrets set ABANDONED_CART_CRON_SECRET="A_LONG_RANDOM_SECRET" PUBLIC_SITE_URL="https://art-moment.com" --project-ref YOUR_PROJECT_REF
```

## Schedule

Use Supabase Dashboard, **Integrations > Cron**, to call the function every 30 minutes.

- Method: `POST`
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/abandoned-cart`
- Header: `Content-Type: application/json`
- Header: `x-cron-secret: A_LONG_RANDOM_SECRET`
- Body:

```json
{
  "action": "send_due"
}
```

Store the URL and secret in Supabase Vault when configuring the job with SQL. Do not place the secret in a migration or commit it to Git.


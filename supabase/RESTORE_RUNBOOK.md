# Art Moment Backup And Restore Runbook

## Backup Policy

- Run `scripts/backup-supabase.ps1` at least weekly and before every database migration.
- Keep the generated folder outside the application server as well as in an encrypted drive.
- Never commit backup data to Git.
- Supabase database backups do not restore deleted Storage objects. Back up product and return-request files separately.

## Create A Logical Backup

From the project root:

```powershell
.\scripts\backup-supabase.ps1
```

The script creates:

- `schema.sql`
- `data.sql`
- `manifest.json` with SHA-256 checksums

## Quarterly Restore Drill

Always test restoration on a new, disposable Supabase project. Never run a restore drill against production.

1. Create a temporary Supabase project.
2. Copy the production Edge Function secret names to a checklist, without exporting their values into Git.
3. Restore `schema.sql`, then `data.sql`, into the temporary project.
4. Deploy the Edge Functions to the temporary project.
5. Run `supabase/restore_verification.sql`.
6. Test one customer login, one store order, stock reservation, reward points, and one email in test mode.
7. Record the test date, duration, failed checks, and corrective action.
8. Delete the temporary project after the drill.

## Required Non-Database Recovery Items

- Edge Functions and migrations from Git.
- Supabase secrets and Resend settings from the secure operations record.
- Product images and uploaded return evidence from Storage.
- Domain, DNS, and email authentication settings.
- Cron jobs for reward expiry and abandoned-cart reminders.

## Production Restore Rule

A production restore needs a maintenance window because the project can be unavailable during restoration. Confirm the chosen recovery point, expected data loss window, and Storage impact before starting.


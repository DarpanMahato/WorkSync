# shift-notifier (Supabase Edge Function)

Sends notifications for:
- New shift assignments (recently created/updated shifts)
- Pre-shift reminders (e.g., 24 hours and 60 minutes before start)

Run it on a schedule (e.g., every 5 minutes). The function is idempotent within the schedule window by checking existing notifications for the same shift/window.

## Deploy

```pwsh
supabase login
supabase link --project-ref <your-project-ref>

supabase functions deploy shift-notifier --no-verify-jwt
```

Ensure these environment variables are set for the function:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

```pwsh
supabase secrets set SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service_key>"
```

## Test invoke

```pwsh
supabase functions invoke shift-notifier --no-verify-jwt
```

## Schedule

Configure a Scheduled Trigger to run every 5 minutes:
- Cron: `*/5 * * * *`
- URL: `https://<ref>.supabase.co/functions/v1/shift-notifier`
- Disable JWT verification or include an Authorization header with a secret.

## Logic overview

- New assignment detection:
  - Select shifts updated/created in last N minutes (N=5).
  - Insert a `notifications` row per matching shift if none exists with `data.kind = 'shift_assigned'` and the same `shift_id`.
  - Send Expo pushes to tokens in `push_tokens`.

- Upcoming reminders (windows 24h and 60m):
  - Find shifts whose `start_time` falls within [window, window + Nmin].
  - Insert a `notifications` row per (shift, window) pair if not sent before.
  - Send a push with a deep link to the schedule.

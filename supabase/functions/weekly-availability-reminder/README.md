# weekly-availability-reminder (Supabase Edge Function)

Sends a weekly reminder every Sunday to all employees to submit their availability for the coming week. It:
- Inserts an in-app notification in the `notifications` table per user.
- Sends an Expo push notification to each user's stored token in `push_tokens`.

Idempotent within the day: If retried on the same Sunday, it avoids duplicate inserts and push sends.

## Deploy

From the `supabase` folder (or project root if you have the CLI configured):

```pwsh
# Login and link if needed
supabase login
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy weekly-availability-reminder --no-verify-jwt
```

Ensure these environment variables are set for the function:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

```pwsh
supabase secrets set SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service_key>"
```

## Test invoke

```pwsh
supabase functions invoke weekly-availability-reminder --no-verify-jwt
```

Note: The function will skip execution if it's not Sunday (UTC). For testing, comment out the weekday guard in the code.

## Schedule (every Sunday)

Use Supabase Scheduled Triggers (Cron) or an external scheduler to hit the function weekly.

Example cron via Supabase Scheduled Triggers:

- Create a trigger named `weekly_availability` with schedule `0 9 * * 0` (Sundays at 09:00 UTC).
- Set the HTTP request to `POST` the function endpoint:
  `https://<ref>.supabase.co/functions/v1/weekly-availability-reminder`
- Disable JWT verification or include a service bearer.

Alternatively, use any external cron (GitHub Actions, Cloud Scheduler) to POST the same URL weekly.

## Data contracts

- Reads `profiles(id, role)` filtering `role = 'employee'`.
- Inserts into `notifications(user_id, title, body, data, read)`.
- Reads from `push_tokens(user_id, token, platform)`.

The mobile app must have previously stored Expo push tokens using the in-app registration helper.
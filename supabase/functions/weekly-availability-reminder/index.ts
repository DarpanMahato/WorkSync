// Edge Function: weekly-availability-reminder
// Purpose: Every Sunday, insert an in-app notification for all employees and
// send an Expo push notification asking them to provide availability for the coming week.

import { serve } from 'jsr:@std/http@1.0.9/serve';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Profile = { id: string; full_name: string | null; role: string | null };
type PushToken = { user_id: string; token: string; platform: string | null };

const TITLE = 'Weekly availability reminder';
const BODY = 'Please submit your availability for the coming week.';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendExpoPush(tokens: string[]) {
  if (tokens.length === 0) return { ok: true };

  const messages = tokens.map((to) => ({
    to,
    title: TITLE,
    body: BODY,
    sound: 'default',
    data: { screen: '/availability' },
    priority: 'high',
  }));

  // Expo allows up to 100 messages per request.
  const batches = chunk(messages, 100);
  for (const batch of batches) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Expo push error:', res.status, text);
    }
  }
  return { ok: true };
}

serve(async (req) => {
  // Create admin client (service role) — edge functions have access to env vars
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Optional guard: If this function is accidentally invoked on a non-Sunday, bail out.
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday
    // Comment this out if you rely solely on the scheduler cron to run on Sundays
    if (day !== 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Not Sunday (UTC)' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1) Fetch all employees
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'employee');
    if (profilesErr) throw profilesErr;
    const users: Profile[] = profiles || [];

    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No employees found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userIds = users.map((u) => u.id);

    // Idempotency window: today (UTC) to avoid duplicates on retries
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Find users who already received today's reminder
    const { data: already, error: alreadyErr } = await admin
      .from('notifications')
      .select('user_id')
      .eq('title', TITLE)
      .gte('created_at', startOfToday.toISOString())
      .lt('created_at', startOfTomorrow.toISOString())
      .in('user_id', userIds);
    if (alreadyErr) throw alreadyErr;
    const alreadySet = new Set<string>((already || []).map((r: any) => r.user_id));

    // 2) Insert in-app notifications (bulk) for those who don't have one yet
    const rows = users
      .filter((u) => !alreadySet.has(u.id))
      .map((u) => ({
      user_id: u.id,
      title: TITLE,
      body: BODY,
      data: { screen: '/availability' },
      read: false,
      }));
    const { error: notifErr } = rows.length
      ? await admin.from('notifications').insert(rows)
      : { error: null } as any;
    if (notifErr) throw notifErr;

    // 3) Load Expo push tokens for these users
    const { data: tokens, error: tokenErr } = await admin
      .from('push_tokens')
      .select('user_id, token, platform')
      .in('user_id', userIds);
    if (tokenErr) throw tokenErr;
    const list: PushToken[] = tokens || [];

    // 4) Send pushes
  // Only send pushes to those who didn't already receive today's reminder
  const tokensToSend = list.filter((t) => !alreadySet.has(t.user_id)).map((t) => t.token);
  await sendExpoPush(tokensToSend);

    return new Response(
      JSON.stringify({ ok: true, users: users.length, inserted: rows.length, tokens: tokensToSend.length }),
      {
      headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('weekly-availability-reminder error:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Edge Function: shift-notifier
// - Notifies users when new shifts are assigned (recently created/updated)
// - Sends reminders before shift start (e.g., 24h and 60m windows)
// Run this on a schedule (e.g., every 5 minutes). The function is idempotent within
// the schedule window by checking existing notifications for the same shift/window.

import { serve } from 'jsr:@std/http@1.0.9/serve';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Shift = {
  id: string;
  employee_id: string;
  start_time: string;
  status: 'scheduled' | 'published' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
};

type PushToken = { user_id: string; token: string; platform: string | null };

const REMINDER_WINDOWS_MIN = [1440, 60]; // 24h and 60m before
const RUN_INTERVAL_MIN = 5; // expected scheduler run interval

async function sendExpoPush(tokens: string[], payload: { title: string; body: string; data?: Record<string, unknown> }) {
  if (tokens.length === 0) return { ok: true };
  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    data: payload.data ?? {},
    priority: 'high',
  }));
  // Batch by 100
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Expo push error:', res.status, text);
    }
  }
  return { ok: true };
}

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) NEW SHIFT ASSIGNMENTS
    // Consider shifts created/updated in the last RUN_INTERVAL_MIN minutes as newly assigned
    const assignedSince = new Date(now.getTime() - RUN_INTERVAL_MIN * 60 * 1000).toISOString();
    const { data: recentShifts, error: recentErr } = await admin
      .from('shifts')
      .select('id, employee_id, start_time, status, created_at, updated_at')
      .not('employee_id', 'is', null)
      .in('status', ['scheduled', 'published', 'accepted'])
      .or(`created_at.gte.${assignedSince},updated_at.gte.${assignedSince}`);
    if (recentErr) throw recentErr;
    const candidateAssigned: Shift[] = (recentShifts || []) as any;

    // Filter out those already notified (shift_assigned) recently (last day)
    const assignedUserIds = [...new Set(candidateAssigned.map((s) => s.employee_id))];
    let assignedToNotify: Shift[] = [];
    if (candidateAssigned.length > 0) {
      const { data: recentNotifs, error: notifsErr } = await admin
        .from('notifications')
        .select('id, user_id, data, created_at')
        .in('user_id', assignedUserIds)
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      if (notifsErr) throw notifsErr;
      const alreadyAssigned = new Set<string>();
      for (const n of recentNotifs || []) {
        const d = (n as any).data || {};
        if (d.kind === 'shift_assigned' && typeof d.shift_id === 'string') {
          alreadyAssigned.add(d.shift_id);
        }
      }
      assignedToNotify = candidateAssigned.filter((s) => !alreadyAssigned.has(s.id));
    }

    // Insert notifications for new assignments
    if (assignedToNotify.length > 0) {
      const rows = assignedToNotify.map((s) => ({
        user_id: s.employee_id,
        title: 'New shift assigned',
        body: 'You have a new shift assigned. Tap to view details.',
        data: { kind: 'shift_assigned', shift_id: s.id, screen: '/schedule' },
        read: false,
      }));
      const { error: insertAssignedErr } = await admin.from('notifications').insert(rows);
      if (insertAssignedErr) throw insertAssignedErr;

      // Push tokens
      const { data: tokens, error: tokenErr } = await admin
        .from('push_tokens')
        .select('user_id, token, platform')
        .in('user_id', [...new Set(assignedToNotify.map((s) => s.employee_id))]);
      if (tokenErr) throw tokenErr;
      const mapTokens: Record<string, string[]> = {};
      for (const t of (tokens || []) as PushToken[]) {
        mapTokens[t.user_id] = mapTokens[t.user_id] || [];
        mapTokens[t.user_id].push(t.token);
      }
      const allTokens = Object.values(mapTokens).flat();
      await sendExpoPush(allTokens, {
        title: 'New shift assigned',
        body: 'You have a new shift assigned. Tap to view details.',
        data: { screen: '/schedule' },
      });
    }

    // 2) UPCOMING SHIFT REMINDERS
    let remindersInserted = 0;
    let reminderPushes = 0;
    for (const windowMin of REMINDER_WINDOWS_MIN) {
      const targetStart = new Date(now.getTime() + windowMin * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + RUN_INTERVAL_MIN * 60 * 1000);
      const { data: upcoming, error: upcomingErr } = await admin
        .from('shifts')
        .select('id, employee_id, start_time, status')
        .not('employee_id', 'is', null)
        .in('status', ['scheduled', 'published', 'accepted'])
        .gte('start_time', targetStart.toISOString())
        .lt('start_time', targetEnd.toISOString());
      if (upcomingErr) throw upcomingErr;
      const up: Shift[] = (upcoming || []) as any;
      if (up.length === 0) continue;

      const userIds = [...new Set(up.map((s) => s.employee_id))];
      const { data: priorNotifs, error: priorErr } = await admin
        .from('notifications')
        .select('id, user_id, data, created_at')
        .in('user_id', userIds)
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (priorErr) throw priorErr;
      const sentSet = new Set<string>();
      for (const n of priorNotifs || []) {
        const d = (n as any).data || {};
        if (d.kind === 'shift_reminder' && String(d.window_min) === String(windowMin) && typeof d.shift_id === 'string') {
          sentSet.add(`${d.shift_id}:${windowMin}`);
        }
      }

      const toRemind = up.filter((s) => !sentSet.has(`${s.id}:${windowMin}`));
      if (toRemind.length === 0) continue;

      const rows = toRemind.map((s) => ({
        user_id: s.employee_id,
        title: 'Upcoming shift reminder',
        body: `Your shift starts in ${windowMin >= 60 ? `${Math.round(windowMin / 60)} hour(s)` : `${windowMin} minute(s)`}.`,
        data: { kind: 'shift_reminder', shift_id: s.id, window_min: windowMin, screen: '/schedule' },
        read: false,
      }));
      const { error: insertRemErr } = await admin.from('notifications').insert(rows);
      if (insertRemErr) throw insertRemErr;
      remindersInserted += rows.length;

      // Push tokens for the affected users
      const { data: tokens, error: tokenErr } = await admin
        .from('push_tokens')
        .select('user_id, token, platform')
        .in('user_id', [...new Set(toRemind.map((s) => s.employee_id))]);
      if (tokenErr) throw tokenErr;
      const allTokens = (tokens || []).map((t: any) => t.token as string);
      await sendExpoPush(allTokens, {
        title: 'Upcoming shift reminder',
        body: 'Please be on time and have a great shift!',
        data: { screen: '/schedule' },
      });
      reminderPushes += allTokens.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        now: nowIso,
        assignedNotified: assignedToNotify?.length ?? 0,
        remindersInserted,
        reminderPushes,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('shift-notifier error:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

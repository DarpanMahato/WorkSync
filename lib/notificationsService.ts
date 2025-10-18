import { supabase } from '@/lib/supabase';

export type Notice = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
};

export async function fetchNotifications(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Notice[];
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');
  if (error) throw error;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  if (error) throw error;
  return count || 0;
}

export function subscribeNotifications(onInsert: (n: Notice) => void) {
  const channel = supabase
    .channel('realtime:notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => {
        onInsert(payload.new as Notice);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to both INSERT and UPDATE events on notifications.
// Useful for keeping unread counts in sync when items are marked read.
export function subscribeNotificationEvents(handlers: {
  onInsert?: (n: Notice) => void;
  onUpdate?: (n: Notice) => void;
}) {
  const channel = supabase
    .channel('realtime:notifications+updates')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => handlers.onInsert?.(payload.new as Notice)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications' },
      (payload) => handlers.onUpdate?.(payload.new as Notice)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

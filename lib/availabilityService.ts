import { supabase } from '@/lib/supabase';

export type Availability = {
  id: string;
  employee_id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  is_recurring: boolean;
  created_at: string;
  updated_at?: string;
};

export async function fetchAvailabilityRange(startIso: string, endIso: string): Promise<Availability[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('employee_id', user.id)
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .order('start_time', { ascending: false });
  if (error) throw error;
  return (data || []) as Availability[];
}

export async function createAvailability(params: {
  date: string; // YYYY-MM-DD local
  start: string; // HH:MM 24h
  end: string; // HH:MM 24h
  is_recurring: boolean;
}): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const startLocal = new Date(`${params.date}T${params.start}:00`);
  const endLocal = new Date(`${params.date}T${params.end}:00`);
  if (!(startLocal instanceof Date) || isNaN(startLocal.getTime())) throw new Error('Invalid start time');
  if (!(endLocal instanceof Date) || isNaN(endLocal.getTime())) throw new Error('Invalid end time');

  const { error } = await supabase.from('availability').insert({
    employee_id: user.id,
    start_time: startLocal.toISOString(),
    end_time: endLocal.toISOString(),
    is_recurring: params.is_recurring,
  });
  if (error) throw error;
}

export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await supabase.from('availability').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeAvailability(onChange: () => void) {
  const channel = supabase
    .channel('realtime:availability')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

import { supabase } from '@/lib/supabase';

export type Range = { startIso: string; endIso: string };

export async function countUpcomingShifts(range: Range): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['scheduled', 'published', 'accepted'])
    .gte('start_time', new Date().toISOString())
    .lt('start_time', range.endIso);
  if (error) throw error;
  return data as any as number; // count returned via head
}

export async function countUnassignedShifts(range: Range): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .is('employee_id', null)
    .gte('start_time', range.startIso)
    .lt('start_time', range.endIso);
  if (error) throw error;
  return data as any as number;
}

export async function countScheduledNeedingPublish(range: Range): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .gte('start_time', range.startIso)
    .lt('start_time', range.endIso);
  if (error) throw error;
  return data as any as number;
}

export async function countEmployees(): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'employee');
  if (error) throw error;
  return data as any as number;
}

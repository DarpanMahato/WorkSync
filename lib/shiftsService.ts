import { supabase } from '@/lib/supabase';

export type Site = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  geo_fence_radius: number | null;
};

export type Shift = {
  id: string;
  site_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'published' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  site?: Site | null;
};

export async function fetchUpcomingShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `id, site_id, employee_id, start_time, end_time, status,
       site:site_id(name, latitude, longitude, geo_fence_radius)`
    )
    .eq('employee_id', (await supabase.auth.getUser()).data.user?.id || '')
    .in('status', ['scheduled', 'published', 'accepted'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as any[];
  return rows.map((r) => ({
    ...r,
    site: Array.isArray(r.site) ? (r.site[0] || null) : r.site,
  })) as Shift[];
}

export async function fetchPastShifts(limit = 20): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `id, site_id, employee_id, start_time, end_time, status,
       site:site_id(name, latitude, longitude, geo_fence_radius)`
    )
    .eq('employee_id', (await supabase.auth.getUser()).data.user?.id || '')
    .lt('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []) as any[];
  return rows.map((r) => ({
    ...r,
    site: Array.isArray(r.site) ? (r.site[0] || null) : r.site,
  })) as Shift[];
}

// Accept/Decline endpoints intentionally omitted per product decision

export function subscribeShifts(onChange: (payload: any) => void) {
  const channel = supabase
    .channel('realtime:shifts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (payload) => {
      onChange(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

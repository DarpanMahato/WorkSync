import { supabase } from '@/lib/supabase';

export type AdminShift = {
  id: string;
  site_id: string | null;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'published' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  employee?: { id: string; full_name: string | null } | null;
  site?: { id: string; name: string } | null;
};

export type ShiftFilters = {
  startIso: string;
  endIso: string;
  status?: AdminShift['status'][];
  employeeId?: string | null;
};

export async function fetchShiftsRange(filters: ShiftFilters): Promise<AdminShift[]> {
  let query = supabase
    .from('shifts')
    .select(
      `id, site_id, employee_id, start_time, end_time, status,
       employee:employee_id(id, full_name),
       site:site_id(id, name)`
    )
    .gte('start_time', filters.startIso)
    .lt('start_time', filters.endIso)
    .order('start_time', { ascending: true });

  if (filters.status && filters.status.length) {
    query = query.in('status', filters.status);
  }
  if (typeof filters.employeeId !== 'undefined' && filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as any[];
  return rows.map((r) => ({
    ...r,
    employee: Array.isArray(r.employee) ? (r.employee[0] || null) : r.employee,
    site: Array.isArray(r.site) ? (r.site[0] || null) : r.site,
  })) as AdminShift[];
}

export async function createShift(input: Omit<AdminShift, 'id' | 'employee' | 'site'>): Promise<string> {
  const payload: any = {
    site_id: input.site_id,
    employee_id: input.employee_id,
    start_time: input.start_time,
    end_time: input.end_time,
    status: input.status,
  };
  const { data, error } = await supabase.from('shifts').insert(payload).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

export async function updateShift(id: string, patch: Partial<Omit<AdminShift, 'id' | 'employee' | 'site'>>): Promise<void> {
  const allowed: any = {};
  for (const k of ['site_id', 'employee_id', 'start_time', 'end_time', 'status'] as const) {
    if (k in patch) (allowed as any)[k] = (patch as any)[k];
  }
  const { error } = await supabase.from('shifts').update(allowed).eq('id', id);
  if (error) throw error;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) throw error;
}

export async function publishShiftsInRange(startIso: string, endIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .update({ status: 'published' })
    .eq('status', 'scheduled')
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

export async function fetchSites(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('sites').select('id, name').order('name');
  if (error) throw error;
  return (data || []) as any;
}

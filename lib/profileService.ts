import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string; // user id
  full_name: string | null;
  role: string | null;
  updated_at?: string;
  created_at?: string;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, updated_at, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) || null;
}

export async function upsertMyProfile(p: Partial<Pick<Profile, 'full_name' | 'role'>>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  // Only allow columns that exist in the profiles table
  const allowed: Partial<Pick<Profile, 'full_name' | 'role'>> = {};
  if (typeof p.full_name !== 'undefined') allowed.full_name = p.full_name;
  if (typeof p.role !== 'undefined') allowed.role = p.role;
  // First try update path to satisfy RLS UPDATE policy
  const { data: updated, error: updateErr } = await supabase.from('profiles').update(allowed).eq('id', user.id).select('id');
  if (updateErr) throw updateErr;
  if (!updated || updated.length === 0) {
    // Row missing — insert with id=user.id (requires INSERT policy)
    const { error: insertErr } = await supabase.from('profiles').insert({ id: user.id, ...allowed } as any);
    if (insertErr) throw insertErr;
  }
}

import { supabase } from '@/lib/supabase';

export type Employee = {
  id: string;
  full_name: string | null;
  role: 'employee' | 'admin' | null;
  email?: string | null;
};

export async function fetchEmployees(): Promise<Employee[]> {
  // profiles table does not include email; fetch from auth if needed for invites list
  const { data, error } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
  if (error) throw error;
  const profiles = (data || []) as Employee[];
  return profiles;
}

export async function setUserRole(userId: string, role: 'employee' | 'admin'): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

export async function inviteEmployee(email: string, fullName: string, role: 'employee' | 'admin' = 'employee'): Promise<void> {
  // Use Supabase signUp to send invite; no password provided means invite magic link
  const { error } = await supabase.auth.signUp({
    email,
    password: Math.random().toString(36).slice(2) + Math.random().toString(36).toUpperCase().slice(2), // temporary
    options: {
      emailRedirectTo: undefined, // use project default or deep link
      data: { full_name: fullName, role },
    },
  });
  if (error) throw error;
}

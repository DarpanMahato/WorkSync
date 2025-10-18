-- Note: auth.users table is managed by Supabase Auth system
-- RLS is automatically enabled on auth.users

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  geo_fence_radius INTEGER DEFAULT 100, -- in meters
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'published', 'accepted', 'declined', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create time_punches table
CREATE TABLE IF NOT EXISTS time_punches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('in', 'out', 'break_start', 'break_end')) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  latitude FLOAT,
  longitude FLOAT,
  accuracy FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create push_tokens table to store Expo push tokens per user
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies

-- Profiles: Users can only see their own profile; admins can see all.
-- Avoid self-referential queries in profiles policies to prevent recursion.
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile row (in case trigger didn't create it)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Check admin via JWT user_metadata claim set at signup (options.data.role)
-- Example: (auth.jwt()->'user_metadata'->>'role') = 'admin'
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- Sites: Only admins can manage sites
CREATE POLICY "Admins can manage sites" ON sites
  FOR ALL USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- Allow employees to view sites that are linked to their own shifts
CREATE POLICY "Employees can view their sites" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shifts
      WHERE shifts.site_id = sites.id AND shifts.employee_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own shifts" ON shifts
  FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Admins can manage all shifts" ON shifts
  FOR ALL USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

CREATE POLICY "Users can manage own availability" ON availability
  FOR ALL USING (auth.uid() = employee_id);

CREATE POLICY "Admins can view all availability" ON availability
  FOR SELECT USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

CREATE POLICY "Users can view own time punches" ON time_punches
  FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Users can create own time punches" ON time_punches
  FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins can view all time punches" ON time_punches
  FOR SELECT USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Push tokens: users can manage their own tokens
CREATE POLICY "Users can manage own push tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Admins can view all push tokens
CREATE POLICY "Admins can view all push tokens" ON push_tokens
  FOR SELECT USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- Functions and Triggers

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert some sample data
INSERT INTO sites (name, address, geo_fence_radius, latitude, longitude) VALUES
  ('Central Warehouse', '123 Main St, City, State 12345', 100, 40.7128, -74.0060),
  ('North Branch', '456 Oak Ave, City, State 12345', 150, 40.7589, -73.9851),
  ('South Office', '789 Pine St, City, State 12345', 75, 40.6892, -74.0445)
ON CONFLICT DO NOTHING;

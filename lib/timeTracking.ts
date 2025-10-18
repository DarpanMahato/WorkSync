import { registerGeofenceForSite, unregisterGeofence } from './geofencing';
import { LocationService } from './location';
import { supabase } from './supabase';

export interface TimePunch {
  id: string;
  employee_id: string;
  shift_id: string | null;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  created_at: string;
}

export interface Shift {
  id: string;
  site_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  status: string;
  site?: {
    name: string;
    latitude: number;
    longitude: number;
    geo_fence_radius: number;
  };
}

export interface ClockStatus {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentShift: Shift | null;
  lastPunch: TimePunch | null;
}

export class TimeTrackingService {
  private static async getLastPunch(userId: string): Promise<TimePunch | null> {
    const { data, error } = await supabase
      .from('time_punches')
      .select('*')
      .eq('employee_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching last punch:', error);
      return null;
    }
    return data || null;
  }

  private static deriveStatusFromLastPunch(lastPunch: TimePunch | null): { isClockedIn: boolean; isOnBreak: boolean } {
    if (!lastPunch) return { isClockedIn: false, isOnBreak: false };
    switch (lastPunch.type) {
      case 'in':
        return { isClockedIn: true, isOnBreak: false };
      case 'break_start':
        return { isClockedIn: true, isOnBreak: true };
      case 'break_end':
        return { isClockedIn: true, isOnBreak: false };
      case 'out':
      default:
        return { isClockedIn: false, isOnBreak: false };
    }
  }

  static async getCurrentShift(userId: string): Promise<Shift | null> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          site:site_id (
            name,
            latitude,
            longitude,
            geo_fence_radius
          )
        `)
        .eq('employee_id', userId)
        .eq('status', 'published')
        .lte('start_time', now)
        .gte('end_time', now)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching current shift:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting current shift:', error);
      return null;
    }
  }

  static async getClockStatus(userId: string): Promise<ClockStatus> {
    try {
      // Get current shift
      const currentShift = await this.getCurrentShift(userId);

      // Get last punch
      const lastPunch = await this.getLastPunch(userId);

      // Determine status based on last punch
      const { isClockedIn, isOnBreak } = this.deriveStatusFromLastPunch(lastPunch);

      return {
        isClockedIn,
        isOnBreak,
        currentShift,
        lastPunch,
      };
    } catch (error) {
      console.error('Error getting clock status:', error);
      return {
        isClockedIn: false,
        isOnBreak: false,
        currentShift: null,
        lastPunch: null,
      };
    }
  }

  static async clockIn(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check last state
      const lastPunch = await this.getLastPunch(userId);
      const { isClockedIn, isOnBreak } = this.deriveStatusFromLastPunch(lastPunch);
      if (isClockedIn) {
        return { success: false, error: isOnBreak ? 'You are currently on a break' : 'You are already clocked in' };
      }

      // Get current shift
      const currentShift = await this.getCurrentShift(userId);
      if (!currentShift) {
        return { success: false, error: 'No active shift found' };
      }

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        return { success: false, error: 'Unable to get your location' };
      }

      // Check if within geo-fence
      const bypassFence = process.env.EXPO_PUBLIC_BYPASS_GEOFENCE === '1';
      if (currentShift.site && !bypassFence) {
        const isWithinFence = LocationService.isWithinGeoFence(
          location.latitude,
          location.longitude,
          currentShift.site.latitude,
          currentShift.site.longitude,
          currentShift.site.geo_fence_radius
        );

        if (!isWithinFence) {
          return {
            success: false,
            error: `You must be within ${currentShift.site.geo_fence_radius}m of ${currentShift.site.name} to clock in`,
          };
        }
      }

      // Create time punch
      const { error } = await supabase.from('time_punches').insert([
        {
          employee_id: userId,
          shift_id: currentShift.id,
          type: 'in',
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
      ]);

      if (error) {
        console.error('Error creating time punch:', error);
        return { success: false, error: 'Failed to clock in' };
      }

      // Start geofencing for this work site to detect exit events
      if (currentShift.site) {
        registerGeofenceForSite({
          latitude: currentShift.site.latitude,
          longitude: currentShift.site.longitude,
          radius: currentShift.site.geo_fence_radius,
          identifier: currentShift.site.name,
          siteName: currentShift.site.name,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error clocking in:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  static async clockOut(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check last state
      const lastPunch = await this.getLastPunch(userId);
      const { isClockedIn } = this.deriveStatusFromLastPunch(lastPunch);
      if (!isClockedIn) {
        return { success: false, error: 'You are not currently clocked in' };
      }

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        return { success: false, error: 'Unable to get your location' };
      }

      // Get current shift (optional for clock out)
      const currentShift = await this.getCurrentShift(userId);

      // Create time punch
      const { error } = await supabase.from('time_punches').insert([
        {
          employee_id: userId,
          shift_id: currentShift?.id || null,
          type: 'out',
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
      ]);

      if (error) {
        console.error('Error creating time punch:', error);
        return { success: false, error: 'Failed to clock out' };
      }

  // Stop geofencing when clocked out
  unregisterGeofence();
  return { success: true };
    } catch (error) {
      console.error('Error clocking out:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  static async startBreak(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check last state
      const lastPunch = await this.getLastPunch(userId);
      const { isClockedIn, isOnBreak } = this.deriveStatusFromLastPunch(lastPunch);
      if (!isClockedIn) {
        return { success: false, error: 'You must be clocked in to start a break' };
      }
      if (isOnBreak) {
        return { success: false, error: 'You are already on a break' };
      }

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        return { success: false, error: 'Unable to get your location' };
      }

      // Get current shift
      const currentShift = await this.getCurrentShift(userId);

      // Create time punch
      const { error } = await supabase.from('time_punches').insert([
        {
          employee_id: userId,
          shift_id: currentShift?.id || null,
          type: 'break_start',
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
      ]);

      if (error) {
        console.error('Error creating break punch:', error);
        return { success: false, error: 'Failed to start break' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error starting break:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  static async endBreak(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check last state
      const lastPunch = await this.getLastPunch(userId);
      const { isOnBreak } = this.deriveStatusFromLastPunch(lastPunch);
      if (!isOnBreak) {
        return { success: false, error: 'You are not currently on a break' };
      }

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        return { success: false, error: 'Unable to get your location' };
      }

      // Get current shift
      const currentShift = await this.getCurrentShift(userId);

      // Create time punch
      const { error } = await supabase.from('time_punches').insert([
        {
          employee_id: userId,
          shift_id: currentShift?.id || null,
          type: 'break_end',
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
      ]);

      if (error) {
        console.error('Error creating break punch:', error);
        return { success: false, error: 'Failed to end break' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error ending break:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  static async getRecentPunches(userId: string, limit: number = 10): Promise<TimePunch[]> {
    try {
      const { data, error } = await supabase
        .from('time_punches')
        .select('*')
        .eq('employee_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent punches:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting recent punches:', error);
      return [];
    }
  }
}

import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const GEOFENCE_TASK = 'worksync-geofence-task';

type RegisterParams = {
  latitude: number;
  longitude: number;
  radius: number; // meters
  identifier?: string; // site id or name
  siteName?: string;
};

async function ensureNotificationPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {}
}

// Prevent redefining the task during fast refresh
let taskDefined = false as boolean;
if (!(global as any).__WS_GEOFENCE_TASK_DEFINED__) {
  (global as any).__WS_GEOFENCE_TASK_DEFINED__ = true;
  taskDefined = true;
}

if (taskDefined) {
TaskManager.defineTask(GEOFENCE_TASK, async (task: any) => {
  const { data, error } = task || {};
  if (error) {
    console.error('Geofence task error:', error);
    return;
  }

  const { eventType, region } = (data || {}) as {
    eventType: Location.GeofencingEventType;
    region?: Location.LocationRegion & { identifier?: string };
  };

  if (eventType === Location.GeofencingEventType.Exit) {
    const siteLabel = region?.identifier || 'work site';

    // Local notification
    await ensureNotificationPermission();
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Left work site',
          body: `You appear to have left ${siteLabel}. If this was a mistake, please return to the site.`,
          sound: 'default',
          data: { kind: 'geofence_exit', site_id: region?.identifier ?? null },
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to schedule local notification:', e);
    }

    // In-app server notification (best effort)
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Left work site',
          body: `You appear to have left ${siteLabel}.`,
          data: { kind: 'geofence_exit', site_id: region?.identifier ?? null, screen: '/schedule' },
          read: false,
        });
      }
    } catch (e) {
      console.warn('Failed to insert server notification for geofence exit:', e);
    }
  }
});
}

export async function registerGeofenceForSite(params: RegisterParams) {
  const { latitude, longitude, radius, identifier } = params;
  // Ensure background location permission for geofencing
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      await Location.requestForegroundPermissionsAsync();
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      await Location.requestBackgroundPermissionsAsync();
    }
  } catch {}
  // Slightly expand radius to reduce false exits due to GPS jitter
  const effectiveRadius = Math.max(30, radius + 15);
  const region: Location.LocationRegion = {
    identifier: identifier || 'worksite',
    latitude,
    longitude,
    radius: effectiveRadius,
    notifyOnEnter: false,
    notifyOnExit: true,
  } as any;
  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK, [region]);
  } catch (e) {
    console.warn('Failed to start geofencing:', e);
  }
}

export async function unregisterGeofence() {
  try {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  } catch (e) {
    // No-op if not started
  }
}

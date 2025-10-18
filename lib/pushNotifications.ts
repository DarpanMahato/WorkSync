import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Device = await import('expo-device');
  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  if (!(Device as any).isDevice) return null;

  const tokenResp = await Notifications.getExpoPushTokenAsync();
  const token = tokenResp.data;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return token;

  // Upsert token
  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });

  return token;
}

export async function sendTestPushAsync(expoPushToken: string, title: string, body: string) {
  // This uses Expo push service endpoint; in production you’d send this from your server.
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: expoPushToken, title, body }),
  });
}

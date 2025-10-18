import { Tabs } from 'expo-router';
import React from 'react';

import { AdminRoute } from '@/components/AdminRoute';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AdminTabLayout() {
  const colorScheme = useColorScheme();

  return (
    <AdminRoute>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <IconSymbol size={28} name="speedometer" color={color} /> }} />
        <Tabs.Screen name="shifts" options={{ title: 'Shifts', tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar.badge.clock" color={color} /> }} />
        <Tabs.Screen name="sites" options={{ title: 'Sites', tabBarIcon: ({ color }) => <IconSymbol size={28} name="mappin.and.ellipse" color={color} /> }} />
        <Tabs.Screen name="employees" options={{ title: 'Employees', tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3" color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape" color={color} /> }} />
      </Tabs>
    </AdminRoute>
  );
}

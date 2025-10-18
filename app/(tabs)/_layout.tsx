import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ProtectedRoute>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Shifts',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />
        <Tabs.Screen
          name="availability"
          options={{
            title: 'Availability',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.and.pencil" color={color} />,
          }}
        />
        <Tabs.Screen
          name="timesheet"
          options={{
            title: 'Timesheet',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person" color={color} />,
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}

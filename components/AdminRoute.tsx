import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) return <Redirect href="/auth/login" />;

  const role = user?.user_metadata?.role;
  if (role !== 'admin') {
    // Non-admins go to the employee tabs
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

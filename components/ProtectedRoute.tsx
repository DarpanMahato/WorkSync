import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  // Avoid mutating navigation during render; use Redirect component instead
  if (!session) return <Redirect href="/auth/login" />;

  return <>{children}</>;
}

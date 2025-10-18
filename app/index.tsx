import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';

export default function Entry() {
  const { user, session, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <ThemedText style={{ marginTop: 8 }}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (!session) return <Redirect href="/auth/login" />;

  const role = user?.user_metadata?.role;
  if (role === 'admin') return <Redirect href="/(admin)/dashboard" />;

  return <Redirect href="/(tabs)" />;
}

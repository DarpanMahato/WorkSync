import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Parse the recovery token from the deep link
        const url = await Linking.getInitialURL();
        const parsed = url ? Linking.parse(url) : undefined;
        const access_token = parsed?.queryParams?.access_token as string | undefined;
        const type = parsed?.queryParams?.type as string | undefined;

        if (access_token && (type === 'recovery' || type === 'invite' || type === 'magiclink')) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token: access_token });
          if (error) throw error;
          if (active) setStatus('ready');
        } else {
          // If user is already authenticated via the recovery flow, allow reset
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (active) setStatus('ready');
          } else {
            if (active) setStatus('error');
          }
        }
      } catch (e) {
        setStatus('error');
      }
    })();
    return () => { active = false; };
  }, []);

  const handleUpdate = async () => {
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Success', 'Password updated. Please sign in again.', [
      { text: 'OK', onPress: () => router.replace('/auth/login') },
    ]);
  };

  if (status === 'checking') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}> 
        <ThemedText>Preparing reset…</ThemedText>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}> 
        <ThemedText>Invalid or expired reset link.</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top }]}> 
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>Set new password</ThemedText>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>New Password</ThemedText>
              <TextInput style={styles.input} placeholder="Enter new password" secureTextEntry value={password} onChangeText={setPassword} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>Confirm Password</ThemedText>
              <TextInput style={styles.input} placeholder="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
            </View>
            <TouchableOpacity style={[styles.resetButton, loading && styles.resetButtonDisabled]} onPress={handleUpdate} disabled={loading}>
              <ThemedText type="defaultSemiBold" style={styles.resetButtonText}>{loading ? 'Updating…' : 'Update Password'}</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { padding: 24, borderRadius: 16, gap: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: 28 },
  form: { gap: 20 },
  inputContainer: { gap: 8 },
  label: { fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#E1E5E9', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: '#F8F9FA' },
  resetButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  resetButtonDisabled: { opacity: 0.6 },
  resetButtonText: { color: '#FFFFFF', fontSize: 16 },
});

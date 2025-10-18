import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { getMyProfile, upsertMyProfile } from '@/lib/profileService';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState<string>('');
  const avatar = user?.user_metadata?.avatar_url || null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const p = await getMyProfile();
        if (mounted && p) {
          setFullName(p.full_name || user?.user_metadata?.full_name || '');
        } else if (mounted) {
          setFullName(user?.user_metadata?.full_name || '');
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              router.replace('/auth/login');
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await upsertMyProfile({ full_name: fullName.trim() });
      setEditOpen(false);
      Alert.alert('Saved', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) {
      Alert.alert('Reset Password', 'No email found on your account.');
      return;
    }
    Alert.alert('Reset Password', 'Send a password reset link to your email?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        const { error } = await resetPassword(user.email!);
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Sent', 'Check your email for a link to reset your password.');
        }
      }}
    ]);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.2)' }]}>
              <ThemedText type="defaultSemiBold">{(fullName || user?.email || 'U').charAt(0).toUpperCase()}</ThemedText>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <ThemedText type="title">{fullName || user?.user_metadata?.full_name || 'User'}</ThemedText>
            <ThemedText style={{ opacity: 0.9 }}>{user?.email}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
        <ThemedText type="subtitle">Account</ThemedText>
        <View style={styles.kvRow}><ThemedText>Role</ThemedText><ThemedText>{user?.user_metadata?.role || 'Employee'}</ThemedText></View>
      </ThemedView>

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={() => setEditOpen(true)}>
          <ThemedText type="defaultSemiBold">Edit Profile</ThemedText>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={handleResetPassword}>
          <ThemedText type="defaultSemiBold">Reset Password</ThemedText>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.destructive]} onPress={handleSignOut}>
          <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>Log Out</ThemedText>
        </Pressable>
      </View>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.sheetOverlay}>
          <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <ThemedText type="title">Edit Profile</ThemedText>
            <View style={{ gap: 10, marginTop: 12 }}>
              <View>
                <ThemedText style={{ marginBottom: 6 }}>Full Name</ThemedText>
                <TextInput value={fullName} onChangeText={setFullName} placeholder="Your name" style={styles.input} />
              </View>
            </View>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => setEditOpen(false)}>
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.actionBtnPrimary, { flex: 1 }]} onPress={handleSave} disabled={loading}>
                <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>{loading ? 'Saving…' : 'Save'}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    gap: 6,
  },
  kvRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actions: {
    gap: 12,
  },
  actionBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  actionBtnPrimary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  destructive: {
    backgroundColor: '#FF3B30',
    borderColor: 'transparent',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)'
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  sheet: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(127,127,127,0.6)',
    marginBottom: 12,
  },
});



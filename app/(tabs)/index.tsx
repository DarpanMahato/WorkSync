import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadCount as getServerUnreadCount, subscribeNotificationEvents } from '@/lib/notificationsService';
import { ClockStatus, TimeTrackingService } from '@/lib/timeTracking';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [clockStatus, setClockStatus] = useState<ClockStatus>({
    isClockedIn: false,
    isOnBreak: false,
    currentShift: null,
    lastPunch: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Load unread notifications count from server
  useEffect(() => {
    let isActive = true;
    async function loadUnread() {
      try {
        if (!user) {
          if (isActive) setUnreadCount(0);
          return;
        }
        const count = await getServerUnreadCount();
        if (isActive) setUnreadCount(count);
      } catch (e) {
        console.warn('Failed to load unread count', e);
      }
    }
    loadUnread();
    return () => {
      isActive = false;
    };
  }, [user]);

  // Keep fresh when screen gains focus (e.g., returning from Notifications screen)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!user) return;
          const count = await getServerUnreadCount();
          if (!cancelled) setUnreadCount(count);
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  // Realtime: adjust count on insert and when notifications are marked read
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeNotificationEvents({
      onInsert: async (n) => {
        if (n.user_id !== user.id) return;
        try {
          const count = await getServerUnreadCount();
          setUnreadCount(count);
        } catch {}
      },
      onUpdate: async (n) => {
        if (n.user_id !== user.id) return;
        try {
          const count = await getServerUnreadCount();
          setUnreadCount(count);
        } catch {}
      },
    });
    return unsubscribe;
  }, [user]);

  const loadClockStatus = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const status = await TimeTrackingService.getClockStatus(user.id);
      setClockStatus(status);
    } catch (error) {
      console.error('Error loading clock status:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load clock status on component mount and when user changes
  useEffect(() => {
    loadClockStatus();
  }, [loadClockStatus]);

  const greeting = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const getStatusText = () => {
    if (clockStatus.isOnBreak) return 'On Break';
    if (clockStatus.isClockedIn) return 'Clocked In';
    return 'Clocked Out';
  };

  const getStatusColor = () => {
    if (clockStatus.isOnBreak) return styles.statusBreak;
    if (clockStatus.isClockedIn) return styles.statusIn;
    return styles.statusOut;
  };

  const handleClockAction = async () => {
    if (!user) return;
    
    setActionLoading(true);
    try {
      let result;
      if (clockStatus.isClockedIn) {
        result = await TimeTrackingService.clockOut(user.id);
      } else {
        result = await TimeTrackingService.clockIn(user.id);
      }

      if (result.success) {
        await loadClockStatus(); // Refresh status
      } else {
        Alert.alert('Error', result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error performing clock action:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreakAction = async (isStarting: boolean) => {
    if (!user) return;
    
    setActionLoading(true);
    try {
      let result;
      if (isStarting) {
        result = await TimeTrackingService.startBreak(user.id);
      } else {
        result = await TimeTrackingService.endBreak(user.id);
      }

      if (result.success) {
        await loadClockStatus(); // Refresh status
      } else {
        Alert.alert('Error', result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error performing break action:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }] }>
        {/* Notifications bell above greeting, aligned right */}
        <View style={styles.topRow}>
          <Link href="/notifications" asChild>
            <Pressable accessibilityRole="button" style={styles.notificationIconBtn}>
              <IconSymbol size={24} name="bell" color="#007AFF" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              )}
            </Pressable>
          </Link>
        </View>
      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={[styles.card, styles.header]}>
        <View style={styles.headerText}>
          <ThemedText type="title" numberOfLines={1}>{greeting},</ThemedText>
          <ThemedText type="title" numberOfLines={1} ellipsizeMode="tail">
            {user?.user_metadata?.full_name || 'User'}
          </ThemedText>
          <ThemedText type="default" style={styles.dateText}>{formattedDate}</ThemedText>
          <View style={[styles.statusBadge, getStatusColor()]}> 
            <ThemedText type="defaultSemiBold" style={styles.statusText}>{getStatusText()}</ThemedText>
          </View>
        </View>
  </ThemedView>

      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
        <ThemedText type="subtitle" style={styles.shiftHeader}>Current Shift</ThemedText>
        {clockStatus.currentShift ? (
          <View style={styles.shiftDetails}>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Date</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(clockStatus.currentShift.start_time).toLocaleDateString()}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Time</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(clockStatus.currentShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {'  –  '}
                {new Date(clockStatus.currentShift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Site</ThemedText>
              <ThemedText style={styles.detailValue}>
                {clockStatus.currentShift.site?.name || 'Unknown Site'}
              </ThemedText>
            </View>
          </View>
        ) : (
          <ThemedText style={styles.cardLine}>No active shift</ThemedText>
        )}
        <View style={{ height: 8 }} />
        <Link href="/schedule">
          <ThemedText type="link">View shifts</ThemedText>
        </Link>
      </ThemedView>

      <Pressable
        accessibilityRole="button"
        onPress={handleClockAction}
        disabled={actionLoading}
        style={({ pressed }) => [
          styles.punchButton,
          clockStatus.isClockedIn ? styles.punchButtonIn : styles.punchButtonOut,
          pressed && styles.punchButtonPressed,
          actionLoading && styles.punchButtonDisabled,
        ]}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="title" style={styles.punchButtonText}>
            {clockStatus.isClockedIn ? 'Clock Out' : 'Clock In'}
          </ThemedText>
        )}
      </Pressable>

      {clockStatus.isClockedIn && (
        <Pressable
          accessibilityRole="button"
          onPress={() => handleBreakAction(!clockStatus.isOnBreak)}
          disabled={actionLoading}
          style={({ pressed }) => [
            styles.punchButton,
            clockStatus.isOnBreak ? styles.breakButtonEnd : styles.breakButtonStart,
            pressed && styles.punchButtonPressed,
            actionLoading && styles.punchButtonDisabled,
          ]}
        >
          {actionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="title" style={styles.punchButtonText}>
              {clockStatus.isOnBreak ? 'End Break' : 'Start Break'}
            </ThemedText>
          )}
        </Pressable>
      )}
      {/* Removed Submit Availability button */}

      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
        <ThemedText type="subtitle">Recent Activity</ThemedText>
        {clockStatus.lastPunch ? (
          <View style={styles.shiftDetails}>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Action</ThemedText>
              <ThemedText style={styles.detailValue}>
                {clockStatus.lastPunch.type === 'in' && 'Clock In'}
                {clockStatus.lastPunch.type === 'out' && 'Clock Out'}
                {clockStatus.lastPunch.type === 'break_start' && 'Break Start'}
                {clockStatus.lastPunch.type === 'break_end' && 'Break End'}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Date</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(clockStatus.lastPunch.timestamp).toLocaleDateString()}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Time</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(clockStatus.lastPunch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          </View>
        ) : (
          <ThemedText style={styles.cardLine}>No recent activity</ThemedText>
        )}
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Link href="/history" style={{ flex: 1 }}>
            <ThemedText type="link">View history</ThemedText>
          </Link>
        </View>
      </ThemedView>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerText: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  dateText: {
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusIn: {
    backgroundColor: '#1db95433',
  },
  statusOut: {
    backgroundColor: '#ff3b3033',
  },
  statusBreak: {
    backgroundColor: '#ff950033',
  },
  statusText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  punchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
  },
  punchButtonOut: {
    backgroundColor: '#007AFF',
  },
  punchButtonIn: {
    backgroundColor: '#FF3B30',
  },
  punchButtonPressed: {
    opacity: 0.9,
  },
  punchButtonDisabled: {
    opacity: 0.6,
  },
  punchButtonText: {
    color: '#fff',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    gap: 6,
  },
  cardLine: {
    opacity: 0.9,
  },
  // Current Shift detail styles
  shiftHeader: {
    marginBottom: 8,
  },
  shiftDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    opacity: 0.7,
    fontSize: 14,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  quickActionDisabled: {
    opacity: 0.5,
  },
  breakButtonStart: {
    backgroundColor: '#FF9500',
  },
  breakButtonEnd: {
    backgroundColor: '#34C759',
  },
  activityRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  activityTime: {
    width: 56,
    opacity: 0.8,
  },
  topRow: {
    alignItems: 'flex-end',
  },
  notificationIconBtn: {
    padding: 8,
    borderRadius: 999,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

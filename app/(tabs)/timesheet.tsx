import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { TimePunch, TimeTrackingService } from '@/lib/timeTracking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TimesheetEntry = {
  id: string;
  date: string; // ISO date
  hours: number;
  regular: number;
  overtime: number;
  punches: TimePunch[];
};

export default function TimesheetScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTimePunches = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const recentPunches = await TimeTrackingService.getRecentPunches(user.id, 50);
      setPunches(recentPunches);
    } catch (error) {
      console.error('Error loading time punches:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load time punches on component mount
  useEffect(() => {
    loadTimePunches();
  }, [loadTimePunches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTimePunches();
    } finally {
      setRefreshing(false);
    }
  }, [loadTimePunches]);

  // Calculate timesheet entries from punches
  const timesheetEntries = useMemo(() => {
    if (!punches.length) return [];

    // Group punches by date
    const punchesByDate = punches.reduce((acc, punch) => {
      const date = new Date(punch.timestamp).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(punch);
      return acc;
    }, {} as Record<string, TimePunch[]>);

    // Calculate hours for each date
    const entries: TimesheetEntry[] = [];
    
    Object.entries(punchesByDate).forEach(([date, dayPunches]) => {
      const sortedPunches = dayPunches.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let totalMinutes = 0;
      let clockInTime: Date | null = null;
      let breakStartTime: Date | null = null;
      let breakMinutes = 0;

      for (const punch of sortedPunches) {
        const punchTime = new Date(punch.timestamp);

        switch (punch.type) {
          case 'in':
            clockInTime = punchTime;
            break;
          case 'out':
            if (clockInTime) {
              const workMinutes = (punchTime.getTime() - clockInTime.getTime()) / (1000 * 60);
              totalMinutes += workMinutes - breakMinutes;
              clockInTime = null;
              breakMinutes = 0;
            }
            break;
          case 'break_start':
            breakStartTime = punchTime;
            break;
          case 'break_end':
            if (breakStartTime) {
              breakMinutes += (punchTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
              breakStartTime = null;
            }
            break;
        }
      }

      const hours = totalMinutes / 60;
      const regularHours = Math.min(hours, 8); // Assuming 8 hours is regular
      const overtimeHours = Math.max(0, hours - 8);

      entries.push({
        id: date,
        date,
        hours,
        regular: regularHours,
        overtime: overtimeHours,
        punches: dayPunches,
      });
    });

    // Sort by date (newest first)
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [punches]);

  // Fortnight since 1st or 3rd Monday of the month (containing today)
  const fortnightStats = useMemo(() => {
    const today = new Date();
    // Find first Monday of the month in local time
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dow = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const offsetToMonday = (1 - dow + 7) % 7; // Monday=1
    const firstMondayLocal = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), firstOfMonth.getDate() + offsetToMonday);
    const thirdMondayLocal = new Date(firstMondayLocal.getFullYear(), firstMondayLocal.getMonth(), firstMondayLocal.getDate() + 14);
    const todayStartLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const inFirstFortnight = todayStartLocal >= firstMondayLocal && todayStartLocal < thirdMondayLocal;
    const startLocal = inFirstFortnight ? firstMondayLocal : thirdMondayLocal;
    const endLocal = new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate() + 13);

    // Compare using UTC midnight to align with entries grouped by UTC date
    const startUTC = new Date(Date.UTC(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate()));
    const endUTC = new Date(Date.UTC(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate()));

    const sum = timesheetEntries.reduce((acc, e) => {
      // e.date is 'YYYY-MM-DD' from toISOString (UTC). Build UTC midnight date
      const eUTC = new Date(`${e.date}T00:00:00Z`);
      if (eUTC >= startUTC && eUTC <= endUTC) return acc + e.hours;
      return acc;
    }, 0);
    const rangeLabel = `${startLocal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endLocal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    return { hours: sum, label: rangeLabel };
  }, [timesheetEntries]);

  const totalHours = timesheetEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalOT = timesheetEntries.reduce((sum, entry) => sum + entry.overtime, 0);

  const formatHM = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderItem = ({ item }: { item: TimesheetEntry }) => {
    const dateLabel = new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    // Build punch chips in chronological order
    const sortedPunches = [...item.punches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const chips = sortedPunches.map((p, idx) => {
      const t = formatHM(new Date(p.timestamp));
      let label = '';
      switch (p.type) {
        case 'in':
          label = `IN ${t}`;
          break;
        case 'out':
          label = `OUT ${t}`;
          break;
        case 'break_start':
          label = `BREAK ${t}`;
          break;
        case 'break_end':
          label = `RESUME ${t}`;
          break;
      }
      return (
        <View key={idx} style={styles.chip}>
          <ThemedText style={styles.chipText}>{label}</ThemedText>
        </View>
      );
    });

    return (
      <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.cardRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{dateLabel}</ThemedText>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[styles.badge, styles.badgePrimary]}>
              <ThemedText style={styles.badgeText}>{item.hours.toFixed(1)}h</ThemedText>
            </View>
            {item.overtime > 0 && (
              <View style={[styles.badge, styles.badgeWarning]}>
                <ThemedText style={styles.badgeText}>OT {item.overtime.toFixed(1)}h</ThemedText>
              </View>
            )}
          </View>
        </View>
        {chips.length > 0 && (
          <View style={styles.chipsRow}>
            {chips}
          </View>
        )}
      </ThemedView>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Loading timesheet...</ThemedText>
      </ThemedView>
    );
  }

  // Legacy: simple recent range label removed while custom ranges are disabled

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {timesheetEntries.length > 0 ? (
        <FlatList
          data={timesheetEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <>
              <ThemedText type="title">Timesheet</ThemedText>
              <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.summary}>
                <ThemedText type="subtitle">Recent Activity</ThemedText>
                <View style={styles.summaryRow}>
                  <ThemedText>Fortnight hours</ThemedText>
                  <ThemedText type="defaultSemiBold">{fortnightStats.hours.toFixed(1)}</ThemedText>
                </View>
                <View style={styles.summaryRow}>
                  <ThemedText>Fortnight period</ThemedText>
                  <ThemedText type="defaultSemiBold">{fortnightStats.label}</ThemedText>
                </View>
                <View style={styles.summaryRow}>
                  <ThemedText>Total Hours</ThemedText>
                  <ThemedText type="defaultSemiBold">{totalHours.toFixed(1)}</ThemedText>
                </View>
                <View style={styles.summaryRow}>
                  <ThemedText>Overtime</ThemedText>
                  <ThemedText type="defaultSemiBold">{totalOT.toFixed(1)}</ThemedText>
                </View>
              </ThemedView>
              <ThemedText type="subtitle">Daily Entries</ThemedText>
            </>
          }
        />
      ) : (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="title">Timesheet</ThemedText>
          <ThemedText style={{ marginTop: 8 }}>No time entries found</ThemedText>
          <ThemedText style={{ opacity: 0.7, marginTop: 4 }}>
            Clock in to start tracking your time
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.3)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  cardRow: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  chipText: {
    fontSize: 12,
    opacity: 0.9,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgePrimary: {
    backgroundColor: 'rgba(0,122,255,0.15)'
  },
  badgeWarning: {
    backgroundColor: 'rgba(255,149,0,0.18)'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
});



import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { countEmployees, countScheduledNeedingPublish, countUnassignedShifts, countUpcomingShifts } from '@/lib/adminDashboardService';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function periodBounds(period: '7d' | '30d') {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (period === '7d' ? 7 : 30));
  return { startIso: start.toISOString(), endIso: now.toISOString() };
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const range = useMemo(() => periodBounds(period), [period]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ upcoming: 0, unassigned: 0, needsPublish: 0, employees: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [upcoming, unassigned, needsPublish, employees] = await Promise.all([
          countUpcomingShifts(range),
          countUnassignedShifts(range),
          countScheduledNeedingPublish(range),
          countEmployees(),
        ]);
        if (active) setStats({ upcoming, unassigned, needsPublish, employees });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [range.startIso, range.endIso]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ThemedText type="title">Admin Dashboard</ThemedText>
      <View style={styles.rowBetween}>
        {(['7d','30d'] as const).map(p => (
          <Pressable key={p} style={[styles.chip, period===p && styles.chipOn]} onPress={()=>setPeriod(p)}>
            <ThemedText style={[styles.chipText, period===p && styles.chipTextOn]}>{p}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        <View style={styles.card}><ThemedText type="subtitle">Upcoming shifts</ThemedText><ThemedText type="title">{stats.upcoming}</ThemedText></View>
        <View style={styles.card}><ThemedText type="subtitle">Unassigned</ThemedText><ThemedText type="title">{stats.unassigned}</ThemedText></View>
        <View style={styles.card}><ThemedText type="subtitle">Need publish</ThemedText><ThemedText type="title">{stats.needsPublish}</ThemedText></View>
        <View style={styles.card}><ThemedText type="subtitle">Employees</ThemedText><ThemedText type="title">{stats.employees}</ThemedText></View>
      </View>

      <ThemedText style={{ opacity: 0.7 }}>Tap a KPI to drill down via the Shifts or Employees tabs.</ThemedText>
      {loading && <ThemedText style={{ opacity: 0.7 }}>Loading…</ThemedText>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: '48%', padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.35)' },
  chipOn: { backgroundColor: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.4)' },
  chipText: {},
  chipTextOn: { color: '#007AFF' },
});

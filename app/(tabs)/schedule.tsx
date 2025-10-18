import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { Shift, fetchPastShifts, fetchUpcomingShifts, subscribeShifts } from '@/lib/shiftsService';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'list' | 'calendar'>('list');
  const [upcoming, setUpcoming] = useState<Shift[]>([]);
  const [past, setPast] = useState<Shift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [u, p] = await Promise.all([fetchUpcomingShifts(), fetchPastShifts(10)]);
      setUpcoming(u);
      setPast(p);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [u, p] = await Promise.all([fetchUpcomingShifts(), fetchPastShifts(10)]);
      setUpcoming(u);
      setPast(p);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    const unsub = subscribeShifts(() => {
      // Lightweight: just refresh lists on any shift change
      load();
    });
    return unsub;
  }, [load]);

  // Ensure Recent section is always newest-first regardless of backend ordering
  const sortedPast = useMemo(() => {
    return [...past].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [past]);

  const humanDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const humanTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderShift = ({ item }: { item: Shift }) => {
    return (
      <Pressable onPress={() => setActiveShift(item)}>
        <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
          <ThemedText type="subtitle">{humanDate(item.start_time)}</ThemedText>
          <ThemedText>{`${humanTime(item.start_time)} - ${humanTime(item.end_time)}`}</ThemedText>
          <ThemedText style={{ opacity: 0.9 }}>{`Site: ${item.site?.name ?? 'Unknown Site'}`}</ThemedText>
          {item.status && (
            <ThemedText style={styles.statusPill}>{String(item.status).toUpperCase()}</ThemedText>
          )}
        </ThemedView>
      </Pressable>
    );
  };

  // Calendar helpers
  const allShifts = [...upcoming, ...past];
  const markedDates = allShifts.reduce<Record<string, any>>((acc, s) => {
    const d = new Date(s.start_time);
    const key = d.toISOString().slice(0, 10);
    acc[key] = { ...(acc[key] || {}), marked: true };
    return acc;
  }, {});
  markedDates[selectedDate] = { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: '#007AFF' };

  const shiftsForSelected = allShifts.filter((s) => {
    const key = new Date(s.start_time).toISOString().slice(0, 10);
    return key === selectedDate;
  });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.segment}>
        <Pressable onPress={() => setSelectedTab('list')} style={[styles.segmentBtn, selectedTab === 'list' && styles.segmentBtnActive]}>
          <ThemedText type="defaultSemiBold">List</ThemedText>
        </Pressable>
        <Pressable onPress={() => setSelectedTab('calendar')} style={[styles.segmentBtn, selectedTab === 'calendar' && styles.segmentBtnActive]}>
          <ThemedText type="defaultSemiBold">Calendar</ThemedText>
        </Pressable>
      </View>

      {selectedTab === 'list' ? (
        loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <SectionList
            sections={[
              { title: 'Upcoming', data: upcoming },
              { title: 'Recent', data: sortedPast },
            ]}
            keyExtractor={(item) => item.id}
            renderItem={renderShift}
            renderSectionHeader={({ section }) => (
              <ThemedText type="subtitle" style={{ marginTop: 8 }}>{section.title}</ThemedText>
            )}
            renderSectionFooter={({ section }) => (
              section.data.length === 0 ? (
                <ThemedText style={{ opacity: 0.8, marginTop: 4 }}>
                  {section.title === 'Upcoming' ? 'No upcoming shifts' : 'No recent shifts'}
                </ThemedText>
              ) : null
            )}
            stickySectionHeadersEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={<ThemedText style={{ opacity: 0.8 }}>No shifts</ThemedText>}
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          <Calendar
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              selectedDayBackgroundColor: '#007AFF',
              todayTextColor: '#FF3B30',
              dotColor: '#007AFF',
            }}
            style={styles.calendar}
          />
          <View style={{ height: 12 }} />
          <ThemedText type="subtitle">Shifts on {new Date(selectedDate).toLocaleDateString()}</ThemedText>
          <FlatList
            data={shiftsForSelected}
            keyExtractor={(i) => i.id}
            renderItem={renderShift}
            ListEmptyComponent={<ThemedText style={{ opacity: 0.8, marginTop: 8 }}>No shifts on this day</ThemedText>}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        </View>
      )}

      <Modal
        visible={!!activeShift}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveShift(null)}
      >
        <View style={styles.sheetOverlay}>
          <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <ThemedText type="title">Shift Details</ThemedText>
            {activeShift && (
              <>
                <ThemedText style={styles.sheetLine}>{humanDate(activeShift.start_time)}</ThemedText>
                <ThemedText style={styles.sheetLine}>{`${humanTime(activeShift.start_time)} - ${humanTime(activeShift.end_time)}`}</ThemedText>
                <ThemedText style={styles.sheetLine}>{`Site: ${activeShift.site?.name ?? 'Unknown Site'}`}</ThemedText>
                <ThemedText style={styles.sheetLine}>{`Status: ${String(activeShift.status).toUpperCase()}`}</ThemedText>
              </>
            )}
            <Pressable style={styles.sheetCloseBtn} onPress={() => setActiveShift(null)}>
              <ThemedText type="defaultSemiBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    gap: 4,
    marginBottom: 12,
  },
  statusPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  calendarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    padding: 24,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
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
  sheetLine: {
    marginTop: 6,
  },
  sheetCloseBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  calendar: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
  },
});



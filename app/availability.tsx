import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Availability, createAvailability, deleteAvailability, fetchAvailabilityRange, subscribeAvailability } from '@/lib/availabilityService';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WheelColumnProps<T> = {
  data: readonly T[] | T[];
  getLabel: (item: T) => string;
  onSelect: (index: number) => void;
  initialIndex?: number;
  selectedIndex?: number;
  onInteractionChange?: (isInteracting: boolean) => void;
};

function WheelColumn<T>({ data, getLabel, onSelect, initialIndex = 0, selectedIndex = 0, onInteractionChange }: WheelColumnProps<T>) {
  const listRef = useRef<ScrollView>(null);
  const itemHeight = 36;
  const visibleCount = 5; // center item + 2 above and below

  const selectFromOffset = (offsetY: number) => {
    const index = Math.round(offsetY / itemHeight);
    onSelect(Math.max(0, Math.min(data.length - 1, index)));
  };

  const handleMomentumEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y as number;
    selectFromOffset(offsetY);
    onInteractionChange?.(false);
  };

  const handleScrollEndDrag = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y as number;
    selectFromOffset(offsetY);
    // Defer to allow snap to settle
    setTimeout(() => onInteractionChange?.(false), 0);
  };

  const handleScrollBeginDrag = () => {
    onInteractionChange?.(true);
  };

  // Ensure the wheel snaps to the initial index on mount
  useEffect(() => {
    const y = itemHeight * initialIndex;
    // Defer until after layout
    const id = setTimeout(() => {
      listRef.current?.scrollTo({ y, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [initialIndex]);

  // Keep the wheel in sync when controlled selectedIndex changes
  useEffect(() => {
    const y = itemHeight * selectedIndex;
    listRef.current?.scrollTo({ y, animated: true });
  }, [selectedIndex]);

  return (
    <View style={{ alignItems: 'center' }}>
      <ScrollView
        ref={listRef}
        style={{ height: itemHeight * visibleCount, width: 72 }}
        contentContainerStyle={{ paddingVertical: ((visibleCount - 1) / 2) * itemHeight }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {(data as T[]).map((item, index) => (
          <View key={index} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText style={index === selectedIndex ? { fontWeight: '600' } : { opacity: 0.9 }}>
              {getLabel(item)}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', top: (itemHeight * visibleCount) / 2 - itemHeight / 2, height: itemHeight, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.35)' }} />
    </View>
  );
}

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const fmtYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const [isRecurring, setIsRecurring] = useState(false);
  const [date, setDate] = useState(''); // YYYY-MM-DD
  // Time selection via triple wheel (hours, minutes, period)
  const HOURS = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const MINUTES = useMemo(() => ['00', '15', '30', '45'], []);
  const PERIODS = useMemo(() => ['AM', 'PM'] as const, []);

  const [startHour, setStartHour] = useState<number>(9);
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState<number>(5);
  const [endMinute, setEndMinute] = useState<string>('00');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Availability[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = useMemo(() => monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [monthCursor]);

  const monthDays = useMemo(() => {
    const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const startWeekday = firstDay.getDay(); // 0-6 (Sun-Sat)
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    const cells: { key: string; label: string; iso?: string; disabled?: boolean }[] = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) cells.push({ key: `b-${i}`, label: '' , disabled: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = fmtYMD(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));
      cells.push({ key: `d-${d}`, label: String(d), iso });
    }
    // Pad to 6 rows * 7 cols = 42 cells
    while (cells.length % 7 !== 0) cells.push({ key: `t-${cells.length}`, label: '', disabled: true });
    while (cells.length < 42) cells.push({ key: `t2-${cells.length}`, label: '', disabled: true });
    return cells;
  }, [monthCursor]);

  // Helpers to format to 24h HH:MM
  const to24h = (h: number, m: string, p: 'AM' | 'PM') => {
    let hour24 = h % 12;
    if (p === 'PM') hour24 += 12;
    return `${hour24.toString().padStart(2, '0')}:${m}`;
  };
  const start = to24h(startHour, startMinute, startPeriod);
  const end = to24h(endHour, endMinute, endPeriod);

  const validate = () => {
    if (!date || !start || !end) {
      return 'Please fill date, start, and end.';
    }
    // Basic formats: YYYY-MM-DD and HH:MM
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date must be YYYY-MM-DD.';
    if (!/^\d{2}:\d{2}$/.test(start)) return 'Start must be HH:MM.';
    if (!/^\d{2}:\d{2}$/.test(end)) return 'End must be HH:MM.';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) return 'End must be after start.';
    return null;
  };

  const loadMonth = async (cursor = monthCursor) => {
    setLoading(true);
    try {
      // Use UTC month boundaries to avoid timezone edge cases around local midnights
      const startIso = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), 1)).toISOString();
      const endIso = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth() + 1, 1)).toISOString();
      const data = await fetchAvailabilityRange(startIso, endIso);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonth();
    const unsub = subscribeAvailability(() => loadMonth());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    await createAvailability({ date, start, end, is_recurring: isRecurring });
    setDate('');
    setStartHour(9);
    setStartMinute('00');
    setStartPeriod('AM');
    setEndHour(5);
    setEndMinute('00');
    setEndPeriod('PM');
    await loadMonth();
  };

  // Page should always be freely scrollable

  const confirmAndDelete = (id: string) => {
    Alert.alert(
      'Delete availability',
      'Are you sure you want to delete this availability entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAvailability(id);
            } finally {
              // Ensure UI reflects deletion immediately even if realtime misses
              await loadMonth();
            }
          },
        },
      ]
    );
  };

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      data={items}
      keyExtractor={(av) => av.id}
      ListHeaderComponent={
        <View>
          <ThemedText type="title">Availability</ThemedText>

          <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardHeader}>Submit Available Times</ThemedText>
            <View style={styles.fieldCol}>
              <ThemedText style={styles.fieldLabel}>Date</ThemedText>
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} style={styles.navBtn}>
                  <ThemedText>{'<'}</ThemedText>
                </Pressable>
                <ThemedText type="defaultSemiBold">{monthLabel}</ThemedText>
                <Pressable onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} style={styles.navBtn}>
                  <ThemedText>{'>'}</ThemedText>
                </Pressable>
              </View>
              <View style={styles.weekdaysRow}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
                  <ThemedText key={w} style={styles.weekday}>{w}</ThemedText>
                ))}
              </View>
              <View style={styles.grid}>
                {monthDays.map((c) => {
                  const isSelected = c.iso === date;
                  return (
                    <Pressable
                      key={c.key}
                      disabled={c.disabled}
                      onPress={() => c.iso && setDate(c.iso!)}
                      style={[styles.cell, isSelected && styles.cellSelected, c.disabled && styles.cellDisabled]}
                    >
                      <ThemedText style={isSelected ? styles.cellSelectedText : undefined}>{c.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {date ? <ThemedText style={{ opacity: 0.9 }}>Selected: {date}</ThemedText> : null}
            </View>
            <View style={styles.timeRow}>
              <Pressable style={styles.timeBox} onPress={() => setActivePicker('start')}>
                <ThemedText style={styles.timeLabel}>Start</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.timeValue}>{start}</ThemedText>
              </Pressable>
              <Pressable style={styles.timeBox} onPress={() => setActivePicker('end')}>
                <ThemedText style={styles.timeLabel}>End</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.timeValue}>{end}</ThemedText>
              </Pressable>
            </View>
            <View style={styles.segmentRow}>
              <Pressable style={[styles.segmentBtn, isRecurring && styles.segmentBtnActive]} onPress={() => setIsRecurring(true)}>
                <ThemedText type="defaultSemiBold">Recurring</ThemedText>
              </Pressable>
              <Pressable style={[styles.segmentBtn, !isRecurring && styles.segmentBtnActive]} onPress={() => setIsRecurring(false)}>
                <ThemedText type="defaultSemiBold">One-time</ThemedText>
              </Pressable>
            </View>
            {error ? <ThemedText style={{ color: '#FF3B30' }}>{error}</ThemedText> : null}
            <Pressable style={styles.submitBtn} onPress={onSubmit}>
              <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>Submit</ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedText type="subtitle">Submitted</ThemedText>
        </View>
      }
      renderItem={({ item: av }) => {
  const dateStr = fmtYMD(new Date(av.start_time));
        const s = new Date(av.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const e = new Date(av.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <ThemedView key={av.id} lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.submittedRow}>
            <ThemedText style={{ flex: 1 }}>{dateStr}</ThemedText>
            <ThemedText style={{ width: 110 }}>{s} - {e}</ThemedText>
            <Pressable onPress={() => confirmAndDelete(av.id)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
              <ThemedText type="link">Delete</ThemedText>
            </Pressable>
          </ThemedView>
        );
      }}
      ListEmptyComponent={
        <ThemedText style={{ opacity: 0.8 }}>{loading ? 'Loading…' : 'No availability yet.'}</ThemedText>
      }
    >
      <Modal
        visible={!!activePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.sheetOverlay}>
          <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetContent}>
              <ThemedText type="title">Select {activePicker === 'start' ? 'Start' : 'End'} Time</ThemedText>
              <View style={[styles.wheelsRow, { marginTop: 8 }]}>
              <WheelColumn
                data={HOURS}
                getLabel={(n) => String(n)}
                onSelect={(i) => activePicker === 'start' ? setStartHour(HOURS[i]) : setEndHour(HOURS[i])}
                initialIndex={HOURS.indexOf(activePicker === 'start' ? startHour : endHour)}
                selectedIndex={HOURS.indexOf(activePicker === 'start' ? startHour : endHour)}
              />
              <WheelColumn
                data={MINUTES}
                getLabel={(s) => s}
                onSelect={(i) => activePicker === 'start' ? setStartMinute(MINUTES[i]) : setEndMinute(MINUTES[i])}
                initialIndex={MINUTES.indexOf(activePicker === 'start' ? startMinute : endMinute)}
                selectedIndex={MINUTES.indexOf(activePicker === 'start' ? startMinute : endMinute)}
              />
              <WheelColumn
                data={PERIODS}
                getLabel={(s) => s}
                onSelect={(i) => activePicker === 'start' ? setStartPeriod(PERIODS[i]) : setEndPeriod(PERIODS[i])}
                initialIndex={PERIODS.indexOf(activePicker === 'start' ? startPeriod : endPeriod)}
                selectedIndex={PERIODS.indexOf(activePicker === 'start' ? startPeriod : endPeriod)}
              />
              </View>
            </View>
            <View style={styles.sheetFooter}>
              <Pressable style={styles.sheetPrimaryBtn} onPress={() => setActivePicker(null)}>
                <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>Done</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

    </FlatList>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  card: {
    gap: 12,
    padding: 16,
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
  cardHeader: {
    marginBottom: 4,
  },
  fieldCol: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  fieldLabel: {
    opacity: 0.9,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  wheelsBlock: {
    gap: 8,
    marginTop: 4,
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)'
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekday: {
    width: `${100/7}%`,
    textAlign: 'center',
    opacity: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: `${(100 - 6 * 8) / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)'
  },
  cellSelected: {
    backgroundColor: 'rgba(0,122,255,0.15)'
  },
  cellDisabled: {
    opacity: 0.3,
  },
  cellSelectedText: {
    fontWeight: '600'
  },
  toggle: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)'
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)'
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.12)'
  },
  submitBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  timeLabel: {
    opacity: 0.8,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
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
  sheetContent: {
    flexGrow: 1,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(127,127,127,0.6)',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)'
  },
  sheetFooter: {
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    paddingTop: 12,
  },
  sheetPrimaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  }
});



import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Punch = {
  id: string;
  ts: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  site?: string;
};

const MOCK_PUNCHES: Punch[] = [
  { id: 'p1', ts: '2025-10-15T09:01:00Z', type: 'in', site: 'HQ Lobby' },
  { id: 'p2', ts: '2025-10-15T13:00:00Z', type: 'break_start' },
  { id: 'p3', ts: '2025-10-15T13:30:00Z', type: 'break_end' },
  { id: 'p4', ts: '2025-10-15T17:00:00Z', type: 'out' },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: Punch }) => (
    <ThemedView lightColor="#FFFFFF" darkColor="#1C1C1E" style={styles.row}>
      <ThemedText style={{ width: 110 }}>
        {new Date(item.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
      <ThemedText style={{ flex: 1 }}>{item.type.replace('_', ' ')}</ThemedText>
      <ThemedText style={{ width: 120, opacity: 0.9 }}>{item.site ?? ''}</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="title">History</ThemedText>
      <FlatList data={MOCK_PUNCHES} keyExtractor={(i) => i.id} renderItem={renderItem} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    marginBottom: 10,
    gap: 8,
  },
});




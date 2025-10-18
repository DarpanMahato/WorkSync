import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchNotifications, markAllRead, markRead, Notice, subscribeNotifications } from '@/lib/notificationsService';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchNotifications();
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeNotifications((n) => {
      setItems((prev) => [n, ...prev]);
    });
    return unsub;
  }, [load]);

  const handlePressItem = async (item: Notice) => {
    if (!item.read) {
      await markRead(item.id);
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, read: true } : it)));
    }
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
  };

  const renderItem = ({ item }: { item: Notice }) => {
    const createdAt = new Date(item.created_at);
    return (
      <Pressable onPress={() => handlePressItem(item)}>
        <ThemedView
          lightColor="#FFFFFF"
          darkColor="#1C1C1E"
          style={[styles.row, !item.read && styles.unreadRow]}
        >
          <View style={styles.rowHeader}>
            <ThemedText type="defaultSemiBold" style={!item.read ? styles.unreadTitle : undefined}>
              {item.title}
            </ThemedText>
            <ThemedText style={styles.timestamp}>
              {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
          <ThemedText style={{ opacity: 0.9 }}>{item.body}</ThemedText>
        </ThemedView>
      </Pressable>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}> 
      <View style={styles.headerRow}>
        <ThemedText type="title">Notifications</ThemedText>
        <Pressable onPress={handleMarkAll} style={styles.markAllBtn}>
          <ThemedText type="link">Mark all read</ThemedText>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <ThemedText style={{ opacity: 0.8, paddingVertical: 12 }}>No notifications</ThemedText>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  row: {
    gap: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    marginBottom: 10,
  },
  unreadRow: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  timestamp: {
    opacity: 0.7,
  },
});




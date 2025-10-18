import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchEmployees, type Employee } from '@/lib/adminEmployeesService';
import { createShift, deleteShift, fetchShiftsRange, fetchSites, publishShiftsInRange, updateShift, type AdminShift } from '@/lib/adminShiftsService';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthBounds(d: Date) {
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { startIso: first.toISOString(), endIso: next.toISOString() };
}

export default function AdminShifts() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<AdminShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<AdminShift['status'][]>(['scheduled', 'published', 'accepted']);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ site_id: string | null; employee_id: string | null; start_date: string; start_time: string; end_date: string; end_time: string; status: AdminShift['status'] }>({ site_id: null, employee_id: null, start_date: fmtDate(new Date()), start_time: '09:00', end_date: fmtDate(new Date()), end_time: '17:00', status: 'scheduled' });

  const range = useMemo(() => monthBounds(cursor), [cursor]);

  async function loadAll() {
    setLoading(true);
    try {
      const [sh, emps, sts] = await Promise.all([
        fetchShiftsRange({ startIso: range.startIso, endIso: range.endIso, status: statusFilter, employeeId: employeeFilter || undefined }),
        fetchEmployees(),
        fetchSites(),
      ]);
      setShifts(sh);
      setEmployees(emps);
      setSites(sts);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startIso, range.endIso, employeeFilter, JSON.stringify(statusFilter)]);

  const onCreate = async () => {
    try {
      setLoading(true);
      const start = new Date(`${form.start_date}T${form.start_time}:00Z`).toISOString();
      const end = new Date(`${form.end_date}T${form.end_time}:00Z`).toISOString();
      await createShift({ site_id: form.site_id, employee_id: form.employee_id, start_time: start, end_time: end, status: form.status, id: '' } as any);
      setEditorOpen(false);
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create shift');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!editId) return;
    try {
      setLoading(true);
      const start = new Date(`${form.start_date}T${form.start_time}:00Z`).toISOString();
      const end = new Date(`${form.end_date}T${form.end_time}:00Z`).toISOString();
      await updateShift(editId, { site_id: form.site_id!, employee_id: form.employee_id!, start_time: start, end_time: end, status: form.status });
      setEditorOpen(false);
      setEditId(null);
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update shift');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { setLoading(true); await deleteShift(id); await loadAll(); } catch (e: any) { Alert.alert('Error', e.message || 'Delete failed'); } finally { setLoading(false); }
      }}
    ]);
  };

  const onBulkPublish = async () => {
    try {
      setLoading(true);
      const count = await publishShiftsInRange(range.startIso, range.endIso);
      Alert.alert('Published', `Published ${count} shift(s)`);
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Bulk publish failed');
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = `${cursor.toLocaleString(undefined, { month: 'long' })} ${cursor.getFullYear()}`;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}> 
      <View style={styles.rowBetween}>
        <Pressable accessibilityRole="button" style={styles.tertiaryBtn} onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ThemedText>{'<'}</ThemedText></Pressable>
        <ThemedText type="title">{monthLabel}</ThemedText>
        <Pressable accessibilityRole="button" style={styles.tertiaryBtn} onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ThemedText>{'>'}</ThemedText></Pressable>
      </View>

      <View style={[styles.rowBetween, { marginTop: 8 }]}> 
        <Pressable accessibilityRole="button" style={styles.primaryBtn} onPress={() => { setEditId(null); setForm({ site_id: sites[0]?.id ?? null, employee_id: employees[0]?.id ?? null, start_date: fmtDate(new Date()), start_time: '09:00', end_date: fmtDate(new Date()), end_time: '17:00', status: 'scheduled' }); setEditorOpen(true); }}>
          <ThemedText style={styles.primaryBtnText}>New Shift</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryBtn} onPress={onBulkPublish}>
          <ThemedText style={styles.secondaryBtnText}>Publish Month</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.filters, { marginTop: 8 }]}> 
        <ThemedText>Filters:</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {(['scheduled','published','accepted','declined','completed','cancelled'] as AdminShift['status'][]).map(s => (
            <Pressable key={s} style={[styles.chip, statusFilter.includes(s) && styles.chipOn]} onPress={() => {
              setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x!==s) : [...prev, s]);
            }}>
              <ThemedText style={[styles.chipText, statusFilter.includes(s) && styles.chipTextOn]}>{s}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshing={loading}
        onRefresh={loadAll}
        ListEmptyComponent={<ThemedText style={{ opacity: 0.7, textAlign: 'center', marginTop: 32 }}>No shifts in this range.</ThemedText>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold">{new Date(item.start_time).toLocaleString()} → {new Date(item.end_time).toLocaleString()}</ThemedText>
            <ThemedText>Employee: {item.employee?.full_name || 'Unassigned'}</ThemedText>
            <ThemedText>Site: {item.site?.name || '—'}</ThemedText>
            <ThemedText>Status: {item.status}</ThemedText>
            <View style={styles.rowBetween}>
              <Pressable accessibilityRole="button" style={styles.tertiaryBtn} onPress={() => { 
                setEditId(item.id);
                setForm({
                  site_id: item.site_id,
                  employee_id: item.employee_id,
                  start_date: fmtDate(new Date(item.start_time)),
                  start_time: new Date(item.start_time).toISOString().slice(11,16),
                  end_date: fmtDate(new Date(item.end_time)),
                  end_time: new Date(item.end_time).toISOString().slice(11,16),
                  status: item.status,
                });
                setEditorOpen(true);
              }}><ThemedText>Edit</ThemedText></Pressable>
              <Pressable accessibilityRole="button" style={[styles.tertiaryBtn, { borderColor: 'rgba(255,59,48,0.4)' }]} onPress={() => onDelete(item.id)}><ThemedText>Delete</ThemedText></Pressable>
            </View>
          </View>
        )}
      />

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.sheetOverlay}>
          <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}> 
            <View style={styles.sheetHandle} />
            <ThemedText type="title">{editId ? 'Edit Shift' : 'New Shift'}</ThemedText>
            <View style={{ gap: 10, marginTop: 12 }}>
              <View>
                <ThemedText>Employee</ThemedText>
                <FlatList horizontal data={employees} keyExtractor={(e)=>e.id} contentContainerStyle={{ gap: 8 }} renderItem={({item}) => (
                  <Pressable style={[styles.chip, form.employee_id===item.id && styles.chipOn]} onPress={()=>setForm(f=>({...f, employee_id: item.id}))}><ThemedText style={[styles.chipText, form.employee_id===item.id && styles.chipTextOn]}>{item.full_name || item.id.slice(0,6)}</ThemedText></Pressable>
                )} />
              </View>
              <View>
                <ThemedText>Site</ThemedText>
                <FlatList horizontal data={sites} keyExtractor={(s)=>s.id} contentContainerStyle={{ gap: 8 }} renderItem={({item}) => (
                  <Pressable style={[styles.chip, form.site_id===item.id && styles.chipOn]} onPress={()=>setForm(f=>({...f, site_id: item.id}))}><ThemedText style={[styles.chipText, form.site_id===item.id && styles.chipTextOn]}>{item.name}</ThemedText></Pressable>
                )} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText>Start Date</ThemedText>
                  <TextInput value={form.start_date} onChangeText={(t)=>setForm(f=>({...f, start_date: t}))} style={styles.input} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ width: 110 }}>
                  <ThemedText>Start Time</ThemedText>
                  <TextInput value={form.start_time} onChangeText={(t)=>setForm(f=>({...f, start_time: t}))} style={styles.input} placeholder="HH:MM" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText>End Date</ThemedText>
                  <TextInput value={form.end_date} onChangeText={(t)=>setForm(f=>({...f, end_date: t}))} style={styles.input} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ width: 110 }}>
                  <ThemedText>End Time</ThemedText>
                  <TextInput value={form.end_time} onChangeText={(t)=>setForm(f=>({...f, end_time: t}))} style={styles.input} placeholder="HH:MM" />
                </View>
              </View>
              <View>
                <ThemedText>Status</ThemedText>
                <FlatList horizontal data={['scheduled','published','accepted','declined','completed','cancelled']} keyExtractor={(s)=>String(s)} contentContainerStyle={{ gap: 8 }} renderItem={({item}) => (
                  <Pressable style={[styles.chip, form.status===item && styles.chipOn]} onPress={()=>setForm(f=>({...f, status: item as AdminShift['status']}))}><ThemedText style={[styles.chipText, form.status===item && styles.chipTextOn]}>{String(item)}</ThemedText></Pressable>
                )} />
              </View>
            </View>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={()=>setEditorOpen(false)}><ThemedText style={styles.secondaryBtnText}>Cancel</ThemedText></Pressable>
              {editId ? (
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={onSave}><ThemedText style={styles.primaryBtnText}>Save</ThemedText></Pressable>
              ) : (
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={onCreate}><ThemedText style={styles.primaryBtnText}>Create</ThemedText></Pressable>
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)', marginBottom: 12, gap: 6 },
  filters: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.35)' },
  chipOn: { backgroundColor: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.4)' },
  chipText: { },
  chipTextOn: { color: '#007AFF' },
  primaryBtn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff' },
  secondaryBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: {},
  tertiaryBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.3)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: 'rgba(127,127,127,0.6)', marginBottom: 12 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.35)' },
});

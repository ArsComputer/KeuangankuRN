import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'keuanganku.v1';

const CATEGORIES = {
  expense: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
  income: ['Uang saku', 'Gaji', 'Bonus', 'Usaha', 'Lainnya'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const LIGHT = {
  bg: '#F6F4EF',
  card: '#FBFAF7',
  text: '#2B2F2C',
  sub: '#5E645F',
  line: '#E0DCD2',
  primary: '#5B8C7A',
  onPrimary: '#FFFFFF',
  chip: '#ECE9E1',
  chipOn: '#DCEBE3',
  chipOnText: '#1F3A30',
  income: '#4E8F6E',
  expense: '#C0645C',
};

const DARK = {
  bg: '#1B1D1F',
  card: '#242729',
  text: '#E4E3DE',
  sub: '#B4B8B2',
  line: '#383C3A',
  primary: '#8FC1AE',
  onPrimary: '#12281F',
  chip: '#2E3234',
  chipOn: '#2F4A40',
  chipOnText: '#D5EADF',
  income: '#7FC4A0',
  expense: '#E59A93',
};

// ---------- helper ----------

const dots = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rupiah = (n) => 'Rp ' + dots(Math.abs(n));
const signedRupiah = (n) => (n < 0 ? '−' : '') + rupiah(n);

const pad2 = (n) => (n < 10 ? '0' + n : String(n));
const toKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const todayKey = () => toKey(new Date());
const shiftKey = (k, days) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + days);
  return toKey(d);
};
const prettyDate = (k) => {
  const d = fromKey(k);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- layar utama ----------

export default function App() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;
  const styles = useMemo(() => makeStyles(c), [scheme]);

  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all'); // all | income | expense
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch (e) {
        // abaikan, mulai dari kosong
      }
      setLoaded(true);
    })();
  }, []);

  const persist = (next) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1
      ),
    [items]
  );

  const income = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const shown = filter === 'all' ? sorted : sorted.filter((t) => t.type === filter);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const save = (t) => {
    if (editing) {
      persist(items.map((x) => (x.id === t.id ? t : x)));
    } else {
      persist([...items, t]);
    }
    closeForm();
  };

  const remove = (id) => {
    persist(items.filter((x) => x.id !== id));
    closeForm();
  };

  const renderItem = ({ item: t }) => {
    const accent = t.type === 'income' ? c.income : c.expense;
    const sign = t.type === 'income' ? '+' : '−';
    return (
      <TouchableOpacity style={styles.row} onPress={() => openEdit(t)} activeOpacity={0.7}>
        <View style={[styles.badge, { backgroundColor: accent + '26' }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{sign}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t.category}</Text>
          {t.note ? (
            <Text style={styles.rowNote} numberOfLines={1}>
              {t.note}
            </Text>
          ) : null}
          <Text style={styles.rowDate}>{prettyDate(t.date)}</Text>
        </View>
        <Text style={[styles.rowAmount, { color: accent }]}>
          {sign}
          {rupiah(t.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      <Text style={styles.title}>Keuanganku</Text>
      <View style={styles.summary}>
        <Text style={styles.sumLabel}>Saldo</Text>
        <Text style={styles.sumBalance}>{signedRupiah(income - expense)}</Text>
        <View style={styles.sumRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sumLabelSmall}>Pemasukan</Text>
            <Text style={[styles.sumSmall, { color: c.income }]}>{rupiah(income)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sumLabelSmall}>Pengeluaran</Text>
            <Text style={[styles.sumSmall, { color: c.expense }]}>{rupiah(expense)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.chips}>
        {[
          ['all', 'Semua'],
          ['income', 'Pemasukan'],
          ['expense', 'Pengeluaran'],
        ].map(([k, label]) => (
          <Chip key={k} label={label} on={filter === k} onPress={() => setFilter(k)} styles={styles} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>Belum ada catatan. Ketuk "+ Catat" untuk mulai.</Text>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Catat</Text>
      </TouchableOpacity>

      <Modal visible={formOpen} animationType="slide" onRequestClose={closeForm}>
        <FormScreen
          key={editing ? editing.id : 'new'}
          initial={editing}
          colors={c}
          styles={styles}
          onSave={save}
          onDelete={remove}
          onClose={closeForm}
        />
      </Modal>
    </View>
  );
}

function Chip({ label, on, onPress, styles }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------- form tambah / ubah ----------

function FormScreen({ initial, colors: c, styles, onSave, onDelete, onClose }) {
  const [type, setType] = useState(initial ? initial.type : 'expense');
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial ? initial.category : CATEGORIES.expense[0]);
  const [note, setNote] = useState(initial ? initial.note : '');
  const [date, setDate] = useState(initial ? initial.date : todayKey());
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const switchType = (t) => {
    if (t === type) return;
    setType(t);
    setCategory(CATEGORIES[t][0]);
  };

  const submit = () => {
    const amount = parseInt(amountText || '0', 10);
    if (!amount || amount <= 0) {
      setError(true);
      return;
    }
    onSave({
      id: initial ? initial.id : newId(),
      createdAt: initial ? initial.createdAt : Date.now(),
      type,
      amount,
      category,
      note: note.trim(),
      date,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.formBar}>
        <TouchableOpacity onPress={onClose} style={styles.barBtn}>
          <Text style={styles.barBtnText}>{'←'} Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{initial ? 'Ubah Catatan' : 'Catat Baru'}</Text>
        <View style={styles.barBtn}>
          {initial ? (
            <TouchableOpacity onPress={() => setConfirmDelete(true)}>
              <Text style={[styles.barBtnText, { color: c.expense }]}>Hapus</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {confirmDelete ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>Hapus catatan ini secara permanen?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.barBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: c.expense }]}
                onPress={() => onDelete(initial.id)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Ya, hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.chips}>
          <Chip label="Pengeluaran" on={type === 'expense'} onPress={() => switchType('expense')} styles={styles} />
          <Chip label="Pemasukan" on={type === 'income'} onPress={() => switchType('income')} styles={styles} />
        </View>

        <Text style={styles.fieldLabel}>Jumlah</Text>
        <View style={[styles.input, error && { borderColor: c.expense }, styles.amountRow]}>
          <Text style={styles.prefix}>Rp</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText ? dots(amountText) : ''}
            onChangeText={(t) => {
              setAmountText(t.replace(/\D/g, '').slice(0, 12));
              setError(false);
            }}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.sub}
          />
        </View>
        {error ? <Text style={styles.errorText}>Isi jumlah lebih dari 0</Text> : null}

        <Text style={styles.fieldLabel}>Kategori</Text>
        <View style={[styles.chips, { flexWrap: 'wrap' }]}>
          {CATEGORIES[type].map((cat) => (
            <Chip key={cat} label={cat} on={category === cat} onPress={() => setCategory(cat)} styles={styles} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Tanggal</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(shiftKey(date, -1))}>
            <Text style={styles.dateBtnText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{prettyDate(date)}</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(shiftKey(date, 1))}>
            <Text style={styles.dateBtnText}>{'›'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayBtn} onPress={() => setDate(todayKey())}>
            <Text style={styles.barBtnText}>Hari ini</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Contoh: makan siang di kantin"
          placeholderTextColor={c.sub}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={styles.saveText}>Simpan</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- gaya ----------

function makeStyles(c) {
  const top = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingTop: top },
    listContent: { padding: 16, paddingBottom: 110 },
    title: { fontSize: 24, fontWeight: '600', color: c.text, marginBottom: 12 },
    summary: { backgroundColor: c.card, borderRadius: 20, padding: 20, marginBottom: 14 },
    sumLabel: { fontSize: 13, color: c.sub },
    sumBalance: { fontSize: 30, fontWeight: '600', color: c.text, marginTop: 2 },
    sumRow: { flexDirection: 'row', marginTop: 16 },
    sumLabelSmall: { fontSize: 12, color: c.sub },
    sumSmall: { fontSize: 16, fontWeight: '500', marginTop: 2 },
    chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.chip },
    chipOn: { backgroundColor: c.chipOn },
    chipText: { color: c.sub, fontSize: 14 },
    chipTextOn: { color: c.chipOnText, fontWeight: '600' },
    empty: { color: c.sub, textAlign: 'center', paddingVertical: 32 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 14,
    },
    badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 22, fontWeight: '500' },
    rowTitle: { color: c.text, fontSize: 15, fontWeight: '500' },
    rowNote: { color: c.sub, fontSize: 13 },
    rowDate: { color: c.sub, fontSize: 11, marginTop: 1 },
    rowAmount: { fontSize: 15, fontWeight: '600' },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 28,
      backgroundColor: c.primary,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 18,
      elevation: 3,
    },
    fabText: { color: c.onPrimary, fontWeight: '600', fontSize: 16 },
    formBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      height: 52,
    },
    barBtn: { minWidth: 80, paddingVertical: 8 },
    barBtnText: { color: c.text, fontSize: 15 },
    formTitle: { color: c.text, fontSize: 17, fontWeight: '600' },
    formContent: { padding: 16, paddingBottom: 48 },
    fieldLabel: { color: c.sub, fontSize: 13, marginBottom: 6, marginTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 16,
      marginBottom: 12,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    prefix: { color: c.sub, fontSize: 16, marginRight: 8 },
    amountInput: { flex: 1, color: c.text, fontSize: 20, fontWeight: '500', padding: 0 },
    errorText: { color: c.expense, fontSize: 12, marginTop: -6, marginBottom: 10 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    dateBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateBtnText: { color: c.text, fontSize: 22, lineHeight: 26 },
    dateText: { color: c.text, fontSize: 16, minWidth: 110, textAlign: 'center' },
    todayBtn: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 10 },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      alignItems: 'center',
      paddingVertical: 15,
      marginTop: 8,
    },
    saveText: { color: c.onPrimary, fontSize: 16, fontWeight: '600' },
    confirmBox: { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 16 },
    confirmText: { color: c.text, marginBottom: 10 },
    confirmBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.chip,
    },
  });
}

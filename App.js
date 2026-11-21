import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Kunci dan bentuk data sama seperti versi sebelumnya, jadi catatan lama tetap aman.
const STORAGE_KEY = 'keuanganku.v1';

const CATEGORIES = {
  expense: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
  income: ['Uang saku', 'Gaji', 'Bonus', 'Usaha', 'Lainnya'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Palet sama dengan versi web.
const LIGHT = {
  bg: '#F2F5F3',
  surface: '#FBFCFB',
  ink: '#232E28',
  sub: '#5A675F',
  line: '#DCE3DE',
  accent: '#3D7C69',
  onAccent: '#FFFFFF',
  chip: '#E7EDE9',
  chipOn: '#D3E6DC',
  chipOnInk: '#1C3D31',
  income: '#2E7A57',
  expense: '#B4524A',
  incomeSoft: '#DCEDE3',
  expenseSoft: '#F4DEDA',
  scrim: 'rgba(20, 28, 24, 0.45)',
};

const DARK = {
  bg: '#151A18',
  surface: '#1E2422',
  ink: '#E3EAE6',
  sub: '#9AA8A0',
  line: '#2C3531',
  accent: '#7CC1A5',
  onAccent: '#10231B',
  chip: '#2A322F',
  chipOn: '#2F4A40',
  chipOnInk: '#D5EADF',
  income: '#6DC39A',
  expense: '#E49A90',
  incomeSoft: '#243A31',
  expenseSoft: '#412B28',
  scrim: 'rgba(0, 0, 0, 0.6)',
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
const dayLabel = (k) => {
  if (k === todayKey()) return 'Hari ini';
  if (k === shiftKey(todayKey(), -1)) return 'Kemarin';
  const d = fromKey(k);
  return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- komponen kecil ----------

function Segmented({ options, value, onChange, styles }) {
  return (
    <View style={styles.seg}>
      {options.map(([key, label]) => {
        const on = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.segBtn, on && styles.segBtnOn]}
            onPress={() => onChange(key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Chip({ label, on, onPress, styles }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

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
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

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
    return () => clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  const persist = (next) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const income = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const sections = useMemo(() => {
    const shown = items
      .filter((t) => filter === 'all' || t.type === filter)
      .sort((a, b) =>
        a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1
      );
    const out = [];
    shown.forEach((t) => {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.data.push(t);
      else out.push({ date: t.date, title: dayLabel(t.date), data: [t] });
    });
    return out;
  }, [items, filter]);

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
    const wasEdit = !!editing;
    persist(wasEdit ? items.map((x) => (x.id === t.id ? t : x)) : [...items, t]);
    closeForm();
    showToast(wasEdit ? 'Perubahan disimpan' : 'Catatan ditambahkan');
  };

  const remove = (id) => {
    persist(items.filter((x) => x.id !== id));
    closeForm();
    showToast('Catatan dihapus');
  };

  const renderItem = ({ item: t }) => {
    const isIn = t.type === 'income';
    const accent = isIn ? c.income : c.expense;
    const sign = isIn ? '+' : '−';
    return (
      <TouchableOpacity style={styles.row} onPress={() => openEdit(t)} activeOpacity={0.7}>
        <View style={[styles.badge, { backgroundColor: isIn ? c.incomeSoft : c.expenseSoft }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{sign}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle}>{t.category}</Text>
          {t.note ? (
            <Text style={styles.rowNote} numberOfLines={1}>
              {t.note}
            </Text>
          ) : null}
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
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo</Text>
        <Text style={styles.balanceBig}>{signedRupiah(balance)}</Text>
      </View>
      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Pemasukan</Text>
          <Text style={[styles.tileAmount, { color: c.income }]}>{rupiah(income)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Pengeluaran</Text>
          <Text style={[styles.tileAmount, { color: c.expense }]}>{rupiah(expense)}</Text>
        </View>
      </View>
      <Segmented
        styles={styles}
        value={filter}
        onChange={setFilter}
        options={[
          ['all', 'Semua'],
          ['income', 'Pemasukan'],
          ['expense', 'Pengeluaran'],
        ]}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => <Text style={styles.groupHead}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {items.length ? 'Tidak ada catatan di filter ini' : 'Belum ada catatan'}
              </Text>
              <Text style={styles.emptyText}>
                {items.length
                  ? 'Pilih filter lain untuk melihat catatan.'
                  : 'Pemasukan dan pengeluaranmu akan tampil di sini. Ketuk "Catat" untuk menambah yang pertama.'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Catat</Text>
      </TouchableOpacity>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeForm}
      >
        <View style={styles.scrim}>
          <Pressable style={{ flex: 1 }} onPress={closeForm} />
          <View style={styles.sheet}>
            {formOpen ? (
              <FormSheet
                initial={editing}
                colors={c}
                styles={styles}
                onSave={save}
                onDelete={remove}
                onClose={closeForm}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- form tambah / ubah (lembar dari bawah) ----------

function FormSheet({ initial, colors: c, styles, onSave, onDelete, onClose }) {
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
    <View style={{ flexShrink: 1 }}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>{initial ? 'Ubah catatan' : 'Catat baru'}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Tutup">
          <Text style={styles.closeText}>{'×'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
      >
        <Segmented
          styles={styles}
          value={type}
          onChange={switchType}
          options={[
            ['expense', 'Pengeluaran'],
            ['income', 'Pemasukan'],
          ]}
        />

        <Text style={styles.fieldLabel}>Jumlah</Text>
        <View style={[styles.amountBox, error && { borderColor: c.expense }]}>
          <Text style={styles.prefix}>Rp</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText ? dots(amountText) : ''}
            onChangeText={(t) => {
              setAmountText(t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12));
              setError(false);
            }}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.sub}
          />
        </View>
        {error ? <Text style={styles.errorText}>Isi jumlah lebih dari 0.</Text> : null}

        <Text style={styles.fieldLabel}>Kategori</Text>
        <View style={styles.chips}>
          {CATEGORIES[type].map((cat) => (
            <Chip key={cat} label={cat} on={category === cat} onPress={() => setCategory(cat)} styles={styles} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Tanggal</Text>
        <View style={styles.dateBox}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(shiftKey(date, -1))}>
            <Text style={styles.dateBtnText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{prettyDate(date)}</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(shiftKey(date, 1))}>
            <Text style={styles.dateBtnText}>{'›'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayBtn} onPress={() => setDate(todayKey())}>
            <Text style={styles.todayText}>Hari ini</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={300}
          placeholder="Contoh: makan siang di kantin"
          placeholderTextColor={c.sub}
        />

        <View style={styles.actions}>
          {initial ? (
            <TouchableOpacity style={styles.delBtn} onPress={() => setConfirmDelete(true)}>
              <Text style={styles.delText}>Hapus</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.saveBtn} onPress={submit} activeOpacity={0.85}>
            <Text style={styles.saveText}>Simpan</Text>
          </TouchableOpacity>
        </View>

        {confirmDelete ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>Hapus catatan ini secara permanen?</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.confirmBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: c.expense, borderColor: c.expense }]}
                onPress={() => onDelete(initial.id)}
              >
                <Text style={[styles.confirmBtnText, { color: c.bg }]}>Ya, hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------- gaya ----------

function makeStyles(c) {
  const top = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingTop: top },
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
    title: { fontSize: 24, fontWeight: '700', color: c.ink, marginBottom: 14 },

    balanceCard: { backgroundColor: c.accent, borderRadius: 20, padding: 20 },
    balanceLabel: { fontSize: 13, fontWeight: '500', color: c.onAccent, opacity: 0.85 },
    balanceBig: { fontSize: 32, fontWeight: '700', color: c.onAccent, marginTop: 2 },
    tiles: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 14 },
    tile: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    tileLabel: { fontSize: 12, color: c.sub },
    tileAmount: { fontSize: 16, fontWeight: '600', marginTop: 2 },

    seg: { flexDirection: 'row', gap: 4, backgroundColor: c.chip, borderRadius: 12, padding: 4 },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
    segBtnOn: { backgroundColor: c.surface, elevation: 1 },
    segText: { fontSize: 14, fontWeight: '500', color: c.sub },
    segTextOn: { color: c.ink, fontWeight: '600' },

    groupHead: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.sub,
      marginTop: 20,
      marginBottom: 8,
      marginLeft: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 20, fontWeight: '500', lineHeight: 24 },
    rowInfo: { flex: 1, minWidth: 0 },
    rowTitle: { color: c.ink, fontSize: 15, fontWeight: '600' },
    rowNote: { color: c.sub, fontSize: 13 },
    rowAmount: { fontSize: 15, fontWeight: '600' },

    empty: {
      marginTop: 28,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.line,
      borderRadius: 16,
    },
    emptyTitle: { color: c.ink, fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
    emptyText: { color: c.sub, textAlign: 'center' },

    fab: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      backgroundColor: c.accent,
      paddingHorizontal: 22,
      paddingVertical: 15,
      borderRadius: 18,
      elevation: 4,
    },
    fabText: { color: c.onAccent, fontWeight: '600', fontSize: 16 },

    toast: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: 96,
      backgroundColor: c.ink,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      maxWidth: '90%',
    },
    toastText: { color: c.bg, fontSize: 14, textAlign: 'center' },

    // lembar form
    scrim: { flex: 1, backgroundColor: c.scrim },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: '92%',
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 12,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.ink },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: { fontSize: 24, color: c.ink, lineHeight: 28 },
    sheetBody: { paddingHorizontal: 16, paddingBottom: 28 },
    fieldLabel: { color: c.sub, fontSize: 13, fontWeight: '500', marginTop: 16, marginBottom: 6 },

    amountBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.bg,
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 56,
    },
    prefix: { color: c.sub, fontSize: 16, fontWeight: '600', marginRight: 8 },
    amountInput: { flex: 1, color: c.ink, fontSize: 24, fontWeight: '700', paddingVertical: 8 },
    errorText: { color: c.expense, fontSize: 13, marginTop: 6 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.chip,
      borderWidth: 1,
      borderColor: c.line,
    },
    chipOn: { backgroundColor: c.chipOn, borderColor: 'transparent' },
    chipText: { color: c.sub, fontSize: 14 },
    chipTextOn: { color: c.chipOnInk, fontWeight: '600' },

    dateBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.bg,
      borderRadius: 12,
      paddingHorizontal: 8,
      minHeight: 52,
    },
    dateBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateBtnText: { color: c.ink, fontSize: 22, lineHeight: 26 },
    dateText: { color: c.ink, fontSize: 16, minWidth: 110, textAlign: 'center' },
    todayBtn: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 8 },
    todayText: { color: c.accent, fontSize: 14, fontWeight: '600' },

    noteInput: {
      minHeight: 84,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.ink,
      fontSize: 16,
    },

    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    delBtn: {
      minHeight: 48,
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    delText: { color: c.expense, fontSize: 15, fontWeight: '600' },
    saveBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },

    confirmBox: {
      marginTop: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.expense,
      borderRadius: 14,
      gap: 10,
    },
    confirmText: { color: c.ink, fontSize: 15 },
    confirmRow: { flexDirection: 'row', gap: 10 },
    confirmBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: { color: c.ink, fontSize: 15, fontWeight: '600' },
  });
}

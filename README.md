# Keuanganku

Aplikasi pencatat keuangan pribadi. Ada dua versi di repo ini:

- **Web** (`index.html`): bisa langsung dibuka dari HP lewat GitHub Pages. Data tersimpan di browser.
- **React Native / Expo** (`App.js`, `package.json`, `app.json`): data tersimpan di HP lewat AsyncStorage.

## Fitur
- Tambah, ubah, hapus catatan pemasukan dan pengeluaran
- Setiap catatan punya jumlah, kategori, tanggal, dan catatan
- Ringkasan saldo, total pemasukan, total pengeluaran
- Filter: Semua / Pemasukan / Pengeluaran
- Tema lembut, otomatis mengikuti mode terang/gelap

## Menjalankan versi React Native
Dari HP: install **Expo Go**, buka https://snack.expo.dev, tempel isi `App.js`.

Dari komputer:
```bash
npm install
npx expo start
```

## Membuat APK
```bash
npm install -g eas-cli
eas build -p android --profile preview
```

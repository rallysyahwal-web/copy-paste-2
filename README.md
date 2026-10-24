# Salin

Web simpel untuk memindahkan teks, gambar, dan file antara HP dan laptop. Tanpa login, tema gelap, riwayat tersimpan sampai kamu hapus sendiri. Backend memakai Supabase, tampilan murni HTML + JavaScript (tanpa build).

## Fitur

- Kirim teks, gambar, dan file (maks 50 MB per file)
- **Tempel & kirim**: satu tombol membaca clipboard lalu langsung mengirim
- Ctrl+V di mana saja untuk menempel gambar, atau seret file ke halaman
- Tombol **Salin** di setiap item untuk menyalin teks atau gambar ke clipboard
- Daftar otomatis diperbarui tiap beberapa detik di semua perangkat

## Struktur

```
index.html   tampilan
app.js       logika aplikasi
config.js    URL & kunci Supabase
setup.sql    tabel + bucket Supabase (jalankan sekali)
```

## 1. Siapkan Supabase

1. Buka proyek Supabase kamu, lalu **SQL Editor > New query**.
2. Paste seluruh isi `setup.sql`, klik **Run**.
3. Cek **Storage**: harus ada bucket privat bernama `transfer`.

## 2. Isi konfigurasi

Edit `config.js`:

- `SUPABASE_URL`: `https://<project-ref>.supabase.co` (tanpa `/rest/v1/`)
- `SUPABASE_KEY`: kunci **anon / publishable**

> Jangan pernah memakai kunci `service_role` atau secret key di file ini.

## 3. Coba di lokal

```bash
python3 -m http.server 8000
```

Buka `http://localhost:8000`. (Tombol salin/tempel butuh HTTPS atau localhost.)

## 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Salin: web copy paste HP dan laptop"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

**Buat repo-nya Private.** Aplikasi ini tanpa login, jadi siapa pun yang memegang URL + kunci Supabase bisa membaca dan menulis datanya. Kalau repo publik, kunci itu ikut terlihat.

## 5. Deploy

**Netlify**: Add new site > Import from Git > pilih repo. Build command kosongkan, publish directory `.`.

**Vercel**: Add New > Project > pilih repo. Framework preset `Other`, tanpa build command.

Simpan link hasil deploy hanya untuk dirimu sendiri.

## Keamanan singkat

- Siapa pun yang tahu link web bisa melihat dan mengirim isinya. Jangan bagikan link-nya.
- Jangan kirim data sangat sensitif (password, KTP, dsb.).
- Kalau link atau kunci bocor: di Supabase ganti kunci API (Settings > API Keys), lalu perbarui `config.js`.
- Mau lebih aman nanti? Tambahkan kode ruang atau login Supabase Auth, lalu ketatkan policy di `setup.sql`.

## Catatan

- Batas 50 MB per file mengikuti paket gratis Supabase.
- Salin gambar ke clipboard butuh browser modern (Chrome, Edge, Safari). Di browser lain pakai **Unduh**.

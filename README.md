# Transfer

Web untuk kirim teks, gambar, dan file antara HP dan laptop. Tanpa login, tema gelap, backend Supabase.

## Fitur
- Kirim teks, gambar, dan file (maks 50 MB per file di paket gratis)
- Realtime: kiriman langsung muncul di perangkat lain
- Tempel gambar dengan Ctrl+V, seret dan lepas file ke halaman
- Kompres gambar otomatis sebelum diunggah (bisa dimatikan)
- Hapus otomatis: tidak, 1 jam, 1 hari, 7 hari, atau 30 hari
- Kirim langsung (WebRTC): file besar lewat jalur antar perangkat, tanpa batas 50 MB dan tanpa memakai storage Supabase
- Ctrl+Enter untuk kirim teks

## Setup
1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel isi `schema.sql`, lalu **Run**.
3. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
4. Isi keduanya di bagian atas `app.js` (`SUPABASE_URL` dan `SUPABASE_KEY`).
5. Push folder ini ke GitHub.
6. Di Netlify atau Vercel, impor repo tersebut. Tidak perlu build command. Folder publish: root.

## Update
Edit file, lalu `git add .`, `git commit -m "update"`, `git push`. Netlify/Vercel deploy ulang otomatis.
Perubahan tabel atau bucket dijalankan lewat SQL Editor Supabase, bukan lewat GitHub.

## Catatan
- **Keamanan:** siapa pun yang tahu link web ini bisa membaca dan mengirim. Jangan bagikan linknya. Anon key memang terlihat di kode, jadi jangan kirim data rahasia.
- **Kirim langsung:** kedua perangkat harus membuka halaman ini. Paling lancar di Wi-Fi yang sama. Penerima menampung file di memori, jadi file yang sangat besar bisa berat di perangkat dengan RAM kecil. File hilang saat halaman ditutup.
- **Batas paket gratis Supabase:** storage 1 GB, bandwidth 5 GB per bulan, dan proyek di-pause setelah 1 minggu tidak aktif. Kalau ter-pause, buka dashboard lalu restore.
- Hapus otomatis berjalan saat halaman dibuka (dicek tiap menit), bukan di server.

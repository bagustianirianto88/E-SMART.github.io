# E-SMART.github.io - SAS/STS LJK Scanner (OMR Lingkaran)

Web statis untuk GitHub Pages untuk scanning OMR LJK sekolah (SAS/STS).

## Fitur inti

- Grid sensor lingkaran abu-abu yang jelas (no peserta dan jawaban).
- Kontrol sensor **real-time** (ubah X/Y/W/H langsung tanpa klik apply).
- Preview LJK + sensor menampilkan jawaban hasil scan sebagai overlay.
- Preview bisa dikoreksi manual dengan klik langsung pada bubble di canvas.
- Threshold arsiran real-time: jika belum mencapai batas, jawaban dianggap kosong.
- Sensor orientasi fleksibel dengan parameter:
  - threshold orientasi,
  - threshold hitam sensor,
  - rotasi ulang otomatis sampai menemukan pola TOP/BOT yang sesuai.
- Multi area soal (hingga 3 area), zoom template, backup/restore, feeder/camera/upload, export Excel.

## Menjalankan lokal

```bash
python -m http.server 8080
```

## Catatan

Browser tidak bisa akses scanner TWAIN/WIA langsung, jadi feeder hardware butuh aplikasi bridge lokal.

## Troubleshooting cepat

### 1) "Invalid API key" Supabase
- Gunakan **Project URL** + **Publishable/Anon key** dari Supabase Project Settings > API.
- **Jangan** gunakan token dengan prefix `sbp_` (itu token Management API, bukan untuk query tabel dari web app).

### 2) Badge versi PR menampilkan `PR #set-parameter`
- Tambahkan query param saat membuka app, contoh:
  - `...?pr=123`
- Maka badge otomatis berubah menjadi `PR #123`.

### 3) "Pull request gagal"
- Pastikan branch sudah memiliki commit terbaru.
- Coba push ulang branch, lalu buat PR lagi dengan title/body singkat.
- Jika masih gagal, cek error dari platform Git provider (umumnya: konflik branch, permission, atau branch protection rule).

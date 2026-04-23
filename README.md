# E-SMART.github.io - SAS/STS LJK Scanner (OMR Lingkaran)

Web statis untuk GitHub Pages untuk scanning OMR LJK sekolah (SAS/STS).

## Fitur inti

- Konfigurasi template interaktif (drag/resize box).
- Zoom template (30%-150%) agar pengaturan sensor lebih mudah.
- OMR berbentuk **lingkaran** untuk pembacaan no peserta dan jawaban.
- No peserta mendukung arah opsi **vertikal** (ke bawah) atau horizontal.
- Jawaban mendukung multi area (hingga 3 area), contoh:
  - Area 1 soal 1-20
  - Area 2 soal 21-40
- Patokan grid otomatis ditampilkan sesuai jumlah soal dan jumlah opsi.
- Sumber scan: upload batch, bridge feeder lokal HTTP, kamera fallback.
- Backup/restore JSON untuk melanjutkan pengerjaan.
- Export hasil ke Excel.

## Menjalankan lokal

```bash
python -m http.server 8080
```

## Catatan

Browser tidak bisa akses scanner TWAIN/WIA langsung, jadi feeder hardware butuh aplikasi bridge lokal.

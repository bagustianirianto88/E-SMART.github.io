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

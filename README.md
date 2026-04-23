# E-SMART.github.io - SAS/STS LJK Scanner (OMR Lingkaran)

Web statis untuk GitHub Pages untuk scanning OMR LJK sekolah (SAS/STS).

## Fitur inti

- Sensor OMR **lingkaran per soal/per opsi** (bukan kotak besar tunggal).
- Nomor peserta dibaca sebagai grid lingkaran (vertikal/horizontal).
- Jawaban siswa dibaca sebagai grid lingkaran per area soal.
- Multi area soal (hingga 3 area), misal area1 1-20 dan area2 21-40.
- Template bisa di-zoom saat mengatur sensor.
- Tersedia tab:
  - Konfigurasi
  - Hasil Scan
  - Preview Sensor (lihat scan terakhir + overlay sensor)
- Sumber scan: upload batch, feeder lokal HTTP bridge, kamera fallback.
- Backup/restore JSON dan export Excel.

## Menjalankan lokal

```bash
python -m http.server 8080
```

## Catatan

Browser tidak bisa akses scanner TWAIN/WIA langsung, jadi feeder hardware butuh aplikasi bridge lokal.

# E-SMART.github.io

Aplikasi web statis yang siap di-host di **GitHub Pages** untuk membantu pemindaian **Lembar Jawaban Komputer (LJK) Evalbee**.

## Fitur utama

- Upload batch gambar hasil scan LJK.
- Mode "paper feeder" berbasis kamera (capture frame beruntun dari browser).
- Upload template LJK dan koreksi perspektif berdasarkan deteksi kotak/tepi lembar.
- Deteksi orientasi atas/bawah, termasuk auto-rotate 180° jika lembar terbalik.
- Input database siswa berdasarkan nomor peserta.
- Penentuan area nomor peserta secara manual (rasio X, Y, W, H) agar fleksibel untuk format LJK yang berbeda.
- Export hasil pemrosesan ke **Excel (.xlsx)**.

## Menjalankan lokal

Karena ini aplikasi statis, cukup buka `index.html` langsung, atau lebih baik gunakan server lokal:

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy ke GitHub Pages

1. Push repo ke GitHub.
2. Buka **Settings → Pages**.
3. Pada **Build and deployment**, pilih source `Deploy from a branch`.
4. Pilih branch (misalnya `main`) dan folder root (`/`).
5. Simpan, tunggu proses publish selesai.

## Catatan penting

- Browser tidak dapat mengakses perangkat scanner feeder (TWAIN/WIA) secara native tanpa aplikasi native tambahan. Karena itu mode feeder di web ini menggunakan kamera.
- Akurasi OCR nomor peserta pada implementasi awal masih heuristik. Untuk produksi, disarankan menambahkan model OCR khusus atau integrasi service OCR.

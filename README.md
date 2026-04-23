# E-SMART.github.io - SAS/STS LJK Scanner

Web statis untuk GitHub Pages yang mendukung proses scanning LJK Evalbee untuk kegiatan **SAS/STS** sekolah.

## Fitur terbaru

- Konfigurasi sensor langsung setelah upload template LJK (drag-and-drop pada canvas).
- Sensor orientasi configurable dengan pola:
  - **Atas: 3 kotak**
  - **Bawah: 2 kotak**
- Area **nomor peserta** bisa digeser manual mengikuti format LJK yang dipakai.
- Area **jawaban** juga bisa digeser untuk auto-koreksi nilai.
- Sumber scan:
  - Upload batch gambar.
  - Hardware paper feeder via **bridge lokal HTTP** (contoh endpoint default `http://localhost:17777/api/next-scan`).
  - Kamera browser sebagai fallback.
- Database peserta terlihat dalam tabel setelah dimuat.
- Penilaian otomatis berbasis kunci jawaban, lalu ekspor hasil ke Excel.

## Format database peserta

CSV (tanpa header wajib):

`nomor_peserta,nama,kelas,ruang,mapel`

Contoh:

`12345,Budi Santoso,9A,Ruang 1,Matematika`

## Menjalankan lokal

```bash
python -m http.server 8080
```

Buka: `http://localhost:8080`

## Deploy GitHub Pages

1. Push ke GitHub.
2. Settings → Pages.
3. Source: Deploy from a branch.
4. Pilih branch dan folder root (`/`).
5. Simpan.

## Catatan teknis

Browser tidak dapat akses TWAIN/WIA scanner secara native tanpa aplikasi bridge lokal. Karena itu mode feeder hardware membutuhkan endpoint lokal yang mengirim image hasil scan.

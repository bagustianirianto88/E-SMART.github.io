# E-SMART.github.io - SAS/STS LJK Scanner

Web statis untuk GitHub Pages yang mendukung proses scanning LJK Evalbee untuk kegiatan **SAS/STS** sekolah.

## Fitur terbaru

- Konfigurasi sensor langsung setelah upload template LJK (drag-and-drop pada canvas overlay).
- Preview template tampil jelas (`img`) dan sensor diatur di layer `canvas`.
- Sensor orientasi configurable dengan pola:
  - **Atas: 3 kotak**
  - **Bawah: 2 kotak**
- Area **nomor peserta** dan **jawaban** bisa digeser manual.
- Sumber scan:
  - Upload batch gambar.
  - Hardware paper feeder via **bridge lokal HTTP** (contoh endpoint default `http://localhost:17777/api/next-scan`).
  - Kamera browser sebagai fallback.
- Database peserta terlihat dalam tabel setelah dimuat.
- Penilaian otomatis berbasis kunci jawaban, lalu ekspor hasil ke Excel.
- Fitur **backup/restore JSON** agar pengerjaan bisa dilanjutkan kapan saja.

## Format database peserta

CSV (tanpa header wajib):

`nomor_peserta,nama,kelas,ruang,mapel`

Contoh:

`12345,Budi Santoso,9A,Ruang 1,Matematika`

## File pendukung SAS/STS

Folder `sas-support/` berisi:

- `template-database-sas.csv` (contoh data siswa)
- `checklist-persiapan-sas-sts.md` (panduan persiapan kegiatan)
- `backup-format-example.json` (contoh struktur backup)

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

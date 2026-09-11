# RedPixel Studio & redPDF Tools

Aplikasi web **Photo & PDF Suite** yang berjalan 100% di sisi klien (client-side) —
tidak ada file yang diunggah ke server mana pun. Semua proses (edit foto, crop,
filter, konversi format gambar, dan olah PDF) dilakukan langsung di browser.

Repo ini sebelumnya berupa **satu file `index.html`** raksasa (HTML + CSS + JS
digabung jadi satu). Struktur ini dirapikan menjadi `index.html` di root
proyek + satu folder `assets/` untuk semua CSS & JS, agar lebih mudah dibaca
dan dirawat — **tanpa mengubah fungsi/logika aplikasi sama sekali**. Semua
fitur bekerja persis seperti sebelumnya.

## 📁 Struktur Folder

```
RedPixel-Studio/
├── index.html         # Halaman utama (markup) + referensi ke assets/
├── assets/
│   ├── style.css        # Custom CSS (di atas Tailwind CSS yang dimuat via CDN)
│   ├── config.js         # Konfigurasi tema Tailwind + setup worker PDF.js
│   └── script.js         # Seluruh logika aplikasi (Photo Studio, Converter, redPDF Tools)
└── README.md
```

## ✨ Fitur

### 📸 Photo Studio
- Upload foto (klik atau drag & drop)
- Crop dengan preset rasio (Free, 1:1, 3:4, 4:3, 16:9)
- Penyesuaian **Kecerahan**, **Kontras**, **Saturasi**
- Tambah teks ke gambar (dengan pilihan warna)
- Export/download hasil edit ke **JPG / PNG / WEBP**
- Cetak langsung ke ukuran A4 penuh, atau layout pasfoto (3x4, 4x6, 2x3 cm)

### 🖼️ Image Converter
- Konversi banyak gambar sekaligus ke format **PNG / JPG / WEBP**
- Pengaturan kualitas kompresi
- Opsi warna latar belakang saat konversi ke format tanpa transparansi

### 📄 redPDF Tools
- **Image to PDF** – gabungkan beberapa gambar jadi satu PDF
- **PDF to Image** – ekstrak setiap halaman PDF menjadi gambar
- **Merge PDF** – gabungkan beberapa file PDF
- **Split PDF** – ambil halaman tertentu dari PDF
- **Compress PDF** – perkecil ukuran file PDF

### 🌗 Lainnya
- Mode gelap/terang (dark/light mode)
- Navigasi dropdown untuk Image Tools & PDF Tools
- Notifikasi toast untuk setiap aksi penting

## 🛠️ Teknologi

Semua library dimuat lewat CDN (tidak perlu instalasi/build tools):

| Library | Kegunaan |
|---|---|
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [Font Awesome](https://fontawesome.com) | Ikon |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | Crop gambar |
| [Fabric.js](http://fabricjs.com/) | Canvas editor (teks, filter) |
| [jsPDF](https://github.com/parallax/jsPDF) | Pembuatan PDF |
| [pdf-lib](https://pdf-lib.js.org/) | Manipulasi PDF (merge, split, dsb.) |
| [PDF.js](https://mozilla.github.io/pdf.js/) | Render/ekstrak halaman PDF |
| [JSZip](https://stuk.github.io/jszip/) | Kompres hasil batch jadi ZIP |

## 🚀 Cara Menjalankan

Karena murni HTML/CSS/JS statis, cukup buka `index.html` langsung di browser,
**atau** jalankan local server (disarankan agar semua fitur berjalan mulus):

```bash
# Dari folder root proyek (RedPixel-Studio/)
python3 -m http.server 8080
```

Lalu buka: `http://localhost:8080/index.html`

> `index.html` mereferensikan file lewat path relatif `assets/style.css`,
> `assets/config.js`, dan `assets/script.js`. Pastikan folder `assets/` tetap
> berada di level yang sama (sejajar) dengan `index.html`.

## 📝 Catatan Perubahan (Refactor)

Perubahan yang dilakukan **hanya bersifat kerapian struktur & kode**, bukan
perubahan fungsi:

1. Blok `<style>...</style>` yang sebelumnya inline di `<head>` dipindahkan
   utuh ke `assets/style.css`.
2. Blok `<script>...</script>` konfigurasi Tailwind & PDF.js worker
   dipindahkan ke `assets/config.js`.
3. Blok `<script>...</script>` besar berisi seluruh logika aplikasi
   dipindahkan ke `assets/script.js`.
4. `index.html` tetap berada di root proyek dan kini hanya berisi markup,
   dengan referensi eksternal ke file CSS & JS di folder `assets/`.
5. Memperbaiki satu kelas Tailwind yang tidak valid (`py-0.2` → `py-0.5` pada
   badge "redPDF") agar konsisten dengan badge sejenis lainnya — murni
   perbaikan visual, tidak memengaruhi perilaku aplikasi.
6. Merapikan indentasi & baris kosong berlebih.

Semua `id` elemen yang dipanggil dari JavaScript (`getElementById`) dan semua
fungsi yang dipanggil dari atribut `onclick`/`onchange`/dll di HTML sudah
diverifikasi cocok satu sama lain — tidak ada fungsi atau elemen yang hilang.

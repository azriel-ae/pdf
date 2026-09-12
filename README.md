# PDF Tools

Aplikasi web **Photo & PDF Suite** yang berjalan 100% di sisi klien (client-side) —
tidak ada file yang diunggah ke server mana pun. Semua proses (edit foto, crop,
filter, konversi format gambar, dan olah PDF) dilakukan langsung di browser.

##  Fitur

###  Photo Studio
- Upload foto (klik atau drag & drop)
- Crop dengan preset rasio (Free, 1:1, 3:4, 4:3, 16:9)
- Penyesuaian **Kecerahan**, **Kontras**, **Saturasi**
- Tambah teks ke gambar (dengan pilihan warna)
- Export/download hasil edit ke **JPG / PNG / WEBP**
- Cetak langsung ke ukuran A4 penuh, atau layout pasfoto (3x4, 4x6, 2x3 cm)

###  Image Converter
- Konversi banyak gambar sekaligus ke format **PNG / JPG / WEBP**
- Pengaturan kualitas kompresi
- Opsi warna latar belakang saat konversi ke format tanpa transparansi

###  PDF convert
- **Image to PDF** – gabungkan beberapa gambar jadi satu PDF
- **PDF to Image** – ekstrak setiap halaman PDF menjadi gambar
- **Merge PDF** – gabungkan beberapa file PDF
- **Split PDF** – ambil halaman tertentu dari PDF
- **Compress PDF** – perkecil ukuran file PDF

  

##  Teknologi

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




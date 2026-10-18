# Taskflow

Aplikasi manajemen tugas berbasis web dengan penyimpanan lokal dan proteksi keamanan terintegrasi.

## Fitur Utama

- Siklus tugas lengkap: tambah, lihat, ubah, dan hapus.
- Edit tugas menyeluruh: ubah nama tugas, skala prioritas, tanggal batas waktu, dan kategori.
- Klasifikasi prioritas: rendah, sedang, dan tinggi.
- Filter kategori: umum, kerja, pribadi, dan keuangan.
- Pemantauan batas waktu: kalkulasi otomatis status keterlambatan tugas.
- Pencarian instan: filter tugas berdasarkan kata kunci nama.
- Tab filter status: filter semua, aktif, dan selesai dengan angka penghitung data.
- Panel pembatalan: pemulihan data setelah penghapusan tunggal maupun massal.
- Penyimpanan lokal: data otomatis tersimpan di LocalStorage dengan validasi kuota.
- Nol dependensi: berjalan murni tanpa pustaka eksternal.

## Arsitektur Teknis

- Antarmuka: HTML5 semantik.
- Gaya visual: CSS modern dengan variabel terpusat dan transisi 150ms.
- Logika aplikasi: JavaScript murni (ES6+) dengan manipulasi DOM standar.
- Penyimpanan data: LocalStorage browser dengan validasi skema ketat.

## Mitigasi Keamanan

- XSS dan DOM-based XSS: Rendering data menggunakan document.createElement dan textContent. Tidak ada penggunaan innerHTML pada input pengguna.
- Content Security Policy: Meta tag CSP membatasi asal sumber skrip, gaya, font, dan frame.
- Clickjacking: Penerapan direktif frame-ancestors dan fungsi frame buster pada JavaScript.
- Prototype Pollution: Parser JSON defensif yang menolak properti terlarang seperti __proto__, constructor, dan prototype.
- Batasan Input: Panjang teks dibatasi maksimal 160 karakter serta pembersihan karakter kontrol ASCII 0-31.
- Proteksi Memori: Batas penyimpanan maksimal 500 tugas dengan penanganan eksepsi QuotaExceededError.

## Panduan Penggunaan

1. Unduh atau ekstrak direktori proyek.
2. Buka file index.html pada browser web modern.
3. Tidak memerlukan server lokal, Node.js, atau instalasi dependensi.

## Struktur Berkas

- index.html: Struktur halaman, form input, modal edit, dan konfigurasi keamanan CSP.
- style.css: Sistem desain tema zinc gelap dan aturan responsivitas layar.
- app.js: Pengelola state tugas, sanitasi input, dan pipa render DOM.

## Lisensi

Lisensi MIT. Bebas digunakan untuk kebutuhan personal maupun komersial.

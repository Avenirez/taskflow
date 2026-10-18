# Tugasku (Taskflow)

Aplikasi manajemen tugas harian berbasis peramban web dengan estetika emerald glassmorphism, penyimpanan lokal, dan sistem keamanan defensif.

## Fitur Utama

- Siklus tugas lengkap: tambah, lihat, tandai selesai, edit, dan hapus.
- Modal edit komprehensif: pembaruan nama tugas, skala prioritas, batas waktu, dan kategori.
- Klasifikasi prioritas: rendah, sedang, dan tinggi dengan pengurutan otomatis.
- Filter kategori: umum, kerja, pribadi, dan belanja.
- Pemantauan tenggat waktu: deteksi otomatis status keterlambatan tugas aktif.
- Pencarian instan: filter daftar secara dinamis berdasarkan kata kunci.
- Tab status navigasi: filter semua, aktif, dan selesai dilengkapi penghitung jumlah data.
- Panel pembatalan (Undo): tombol pemulihan data setelah tugas dihapus tunggal maupun massal.
- Kontrol audio: efek suara sintetis berbasis Web Audio API dengan saklar kendali senyap.
- Efek penyelesaian: animasi konfeti interaktif saat seluruh tugas mencapai progres 100%.
- Nol dependensi: beroperasi penuh tanpa pustaka pihak ketiga maupun koneksi server eksternal.

## Arsitektur Teknis

- Markup: HTML5 semantik.
- Gaya Visual: CSS modern dengan tema emerald glassmorphism, variabel terpusat, dan responsivitas layar penuh.
- Logika: JavaScript murni (ES6+) dengan manipulasi DOM standar.
- Penyimpanan: LocalStorage peramban dengan validasi skema data ketat.

## Mitigasi Keamanan

- XSS dan DOM-based XSS: Seluruh data dinamis dirender melalui document.createElement dan textContent. Tidak ada penggunaan innerHTML pada data masukan pengguna.
- Sanitasi Input: Pembersihan karakter kontrol ASCII 0-31 dan pembatasan panjang teks maksimal 160 karakter.
- Prototype Pollution: Parser JSON defensif memfilter kunci berbahaya (__proto__, constructor, prototype) saat membaca penyimpanan lokal.
- Validasi Whitelist: Nilai prioritas dan kategori diverifikasi ketat menggunakan struktur data Set sebelum disimpan.
- Proteksi Kuota Memori: Batasan maksimal 500 item tugas dengan penanganan eksepsi QuotaExceededError.
- Keamanan Dokumen: Penerapan meta tag X-Content-Type-Options nosniff dan Referrer-Policy no-referrer.

## Panduan Penggunaan

1. Buka berkas index.html langsung pada peramban web (Google Chrome, Microsoft Edge, Mozilla Firefox, atau Safari).
2. Tidak memerlukan instalasi paket, Node.js, atau konfigurasi peladen web tambahan.

## Struktur Berkas

- index.html: Struktur antarmuka, form tugas, filter toolbar, modal edit, dan penampung notifikasi.
- style.css: Sistem desain emerald glassmorphism, animasi transisi, dan tata letak responsif.
- app.js: Pengelola state tugas, sanitasi data, mesin render DOM, synthesizer audio, dan canvas konfeti.
- README.md: Dokumentasi teknis proyek.

## Lisensi

Lisensi MIT. Bebas digunakan untuk kebutuhan personal maupun komersial.

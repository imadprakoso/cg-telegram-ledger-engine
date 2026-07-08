# Cipta Grafika Telegram Ledger Engine

Aplikasi web statis untuk mengubah hasil export chat Telegram `messages.html` menjadi data transaksi accounting yang rapi.

## Cara pakai

1. Buka `index.html` di browser.
2. Klik **Pilih messages.html**.
3. Upload file export Telegram Desktop.
4. Sistem akan:
   - membaca pesan Telegram,
   - mengambil `List TF CG` terbaru per tanggal,
   - memecah list menjadi transaksi,
   - mengelompokkan rekening, vendor, nominal, deskripsi, dan kode CG,
   - mengklasifikasikan transaksi,
   - memvalidasi status nota dan invoice,
   - menyiapkan export Excel.
5. Klik **Export Excel Final** untuk mengunduh file `.xls` multi-sheet.

## Aturan accounting yang dipakai

- Semua transaksi perlu nota/bukti.
- Invoice hanya wajib untuk kategori **Outsourcing**.
- Pembelian bahan, penambahan persediaan, perlengkapan, aset, dan operasional tidak wajib invoice.
- Pembelian aset cukup nota/bukti pembelian.

## Sheet Excel

- Ringkasan
- Semua Transaksi Final
- List Pemegang Rekening
- Outsourcing
- Membeli Bahan
- Menambah Persediaan
- Membeli Perlengkapan
- Pembelian Aset
- Biaya Operasional
- Refund
- Pettycash Top Up
- Kurang Nota
- Kurang Invoice
- Perlu Dicek
- Rekap Vendor
- Rekap Rekening
- Rekap Kategori
- Riwayat List Telegram
- Data Mentah
- Keyword Rules

## Catatan penting

Aplikasi ini full client-side. File Telegram diproses di browser dan tidak dikirim ke server.

Untuk OCR foto nota, versi ini baru mengindeks link foto dari HTML berdasarkan kode CG. OCR sungguhan bisa ditambahkan nanti memakai Google Cloud Vision OCR atau Document AI.

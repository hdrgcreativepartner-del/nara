# NARA v6.5.0 — AI lokal dengan validasi pencatatan

## Aktivasi
Akun → AI lokal NARA → pilih Ringan (Qwen2.5 0.5B) atau Lebih besar (Qwen2.5 1.5B) → Unduh / aktifkan. Tidak ada API key atau akun cloud yang diperlukan. WebGPU harus tersedia; jika tidak, status menjelaskan keterbatasan dan pencatatan biasa tetap berjalan. Model belum otomatis terpasang di perangkat pengguna hanya karena kode website di-update.

Unduhan awal ratusan MB sampai lebih dari 1 GB tergantung model. RAM/GPU diperlukan lebih besar daripada ukuran unduhan. Model q4f32 dipilih untuk tidak mensyaratkan shader-f16. Cakupan bahasa dan kualitas model kecil terbatas; tidak ada janji seluruh KBBI, semua dialek Jawa, atau zero failure. Tidak ada kuota inference API; komputasi menggunakan perangkat pengguna.

## Alur
1. Parser dan konteks lokal menangani perintah yang dikenal, pembatalan, negasi, perhitungan dan koreksi.
2. Percakapan belum dipahami/dukungan/nominal ambigu dapat diteruskan ke model lokal yang siap.
3. Model mengeluarkan JSON jawaban dan usulan opsional. Output dianggap tidak tepercaya.
4. Validasi jenis, nama, nominal rupiah bulat, tanggal, dan jam. Tidak ada akses model ke fungsi mutasi data.
5. Pengguna membuka “Tinjau usulan AI”, memperbaiki isinya jika perlu, lalu konfirmasi.
6. Validasi saldo saat konfirmasi; cegah klik ganda dan pembayaran melebihi sisa. Hitungan tetap berasal dari ledger.

Model tidak mengeksekusi perintah edit/hapus. Percakapan yang menyebut rencana/negasi harus meminta klarifikasi, bukan otomatis dicatat. Model masih bisa salah: preview dan konfirmasi menjadi batas mutasi.

## Privasi dan lifecycle
Default mode lokal tidak mengirim pesan ke Cloudflare. Chat dan sampai empat pesan konteks dikirim melalui postMessage ke dedicated Web Worker di perangkat. Runtime WebLLM 0.2.85 diambil dari jsDelivr, bobot Qwen dari Hugging Face/mlc-ai, library WASM dari repositori resmi mlc-ai; layanan tersebut menerima request unduhan aset, bukan isi chat. Mode online lama tetap ada sebagai opsi terpisah, harus diaktifkan pengguna; mengaktifkan lokal mematikannya.

Load model maksimum 15 menit, inference maksimum 90 detik. Batal/timeout/error mengakhiri Worker dan membebaskan resource. Perintah yang sudah dikenal tetap tersedia. UI tidak menjalankan inference berat di main thread. Model dimuat ulang melalui tombol setelah membuka ulang aplikasi; cache menghindari download ulang bila masih tersedia.

Service Worker menyimpan shell NARA secara network-first dengan fallback cache. Hanya cache shell versi lama dibersihkan; cache model tidak dihapus saat membuka NARA. Offline penuh memerlukan kunjungan sukses, shell/runtime dan semua aset model sudah tersimpan. Browser dapat menghapus cache; jangan menjanjikan offline permanen. Notifikasi native tetap di median-bridge.js.

## Konsistensi data
Kartu hutang dan rincian dihitung ulang dari transaksi, termasuk pada render langsung. Balasan chat lama adalah riwayat, bukan saldo hidup. Menu “Periksa rincian” menampilkan pokok, pembayaran, sisa dan status dari sumber yang sama. Penyimpanan gagal mengembalikan state terakhir yang berhasil disimpan serta menampilkan pemberitahuan, bukan mempertahankan pesan sukses.

## Pengujian
`node tests/local-ai.mjs` menguji lifecycle dengan worker tiruan, timeout, pembatalan, retry, perangkat tidak didukung, dan preservasi cache model. `tests/conversation.mjs` menguji draft AI tidak tepercaya, validasi, konfirmasi ganda, overpayment, rollback saat storage penuh, serta screenshot hutang 35k + 65k yang sudah dibayar seluruhnya tetapi kartu lama masih 65k. Test ini tidak menggantikan inference nyata di GPU target atau pengujian Android Median.

Sumber runtime: https://webllm.mlc.ai/docs/ ; model: https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f32_1-MLC

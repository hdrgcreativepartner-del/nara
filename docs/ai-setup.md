# AI percakapan opsional

Status v6.4.0: adapter frontend dan backend tersedia; belum ada layanan AI yang di-deploy atau akun Cloudflare yang terhubung. NARA tetap memakai parser lokal. Ini bukan seluruh KBBI atau pemahaman bahasa universal.

Backend `backend/worker.mjs` memakai Workers AI. Cloudflare menyediakan alokasi gratis harian 10.000 neurons; kuota dan model dapat berubah. Gunakan Workers Free untuk batas gratis, jangan aktifkan paket berbayar jika tidak ingin biaya. Cek https://developers.cloudflare.com/workers-ai/platform/pricing/ dan katalog model sebelum deployment.

1. Masuk ke akun Cloudflare milik pengelola melalui Wrangler di komputer sendiri: `npx wrangler login`.
2. Dari folder backend, simpan kode akses panjang acak menggunakan `npx wrangler secret put NARA_ACCESS_TOKEN`. Jangan commit kode akses, API token Cloudflare, atau kunci provider.
3. Periksa `AI_MODEL` masih tersedia untuk Free; sesuaikan dengan model chat di katalog Cloudflare. Binding `AI` menjalankan model tanpa kunci provider di frontend.
4. Jalankan `npx wrangler deploy`. Simpan URL Worker yang dihasilkan.
5. NARA → Akun → AI tambahan: isi URL dan kode akses backend (bukan token akun Cloudflare), lalu centang izin kirim percakapan. Kode akses disimpan hanya di sessionStorage; masukkan lagi pada sesi baru.

Mode ini membantu obrolan bebas, merangkum, memberi dukungan, dan menjelaskan instruksi. Hanya fallback yang belum dipahami/percakapan dukungan dikirim beserta paling banyak enam pesan sebelumnya. Ledger lengkap, profil, backup, dan seluruh riwayat tidak diunggah. Enam pesan itu bisa mengandung informasi pribadi; pengguna mengaktifkan izin secara eksplisit. Output model adalah teks dan tidak bisa menulis transaksi. Kuota habis, offline, timeout, atau respons invalid kembali ke jawaban lokal. Tidak ada logging isi chat pada kode Worker.

Backend ini untuk penggunaan pribadi dengan kode akses sesi. Untuk layanan multiuser publik, tambahkan autentikasi per pengguna, pembatasan kuota server per pengguna, dan pemantauan penyalahgunaan sebelum membagikannya. CORS bukan autentikasi; kode akses backend tetap wajib.

Tes otomatis memakai binding AI tiruan, bukan klaim pengujian inference Cloudflare secara langsung.

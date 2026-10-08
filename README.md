# NARA

**NARA — Personal Daily Assistant**

NARA adalah aplikasi personal assistant berbasis percakapan untuk membantu pengguna mencatat kehidupan sehari-hari dengan cara yang natural.

## MVP
- Chat-first input
- Reminder & agenda
- Notes
- Personal finance
- Goals & habits
- Local-first storage
- Offline-capable PWA
- Responsive & adaptive: mobile, tablet, desktop

## Contoh input
- `Makan siang 25 ribu`
- `Besok jam 10 meeting dengan Pak Budi`
- `Catat ide: belajar NovaLCT lebih dalam`
- `Bulan ini rutin sholat, olahraga 3 kali seminggu, belajar hal baru`

## Teknologi
Vanilla HTML, CSS, dan JavaScript agar ringan dan mudah dideploy ke GitHub Pages. Versi produksi berikutnya dapat memakai backend/API dan database di `hdrgstudio.com`.

## Status
MVP development build.

## Percakapan v6.3.0

- Pesan bertahap: `bayar komisi` → `50rb` → `ralat 75rb`. Transaksi terakhir diperbarui, tanpa membuat transaksi ganda.
- Agenda bertahap: `ingatkan rapat` → `dengan Pak Budi` → `Senin jam 9 pagi` → `tempatnya di kantor`.
- Koreksi tanggal/jam, jenis pemasukan/pengeluaran, judul, detail catatan, dan langkah target melalui percakapan.
- Pertanyaan `berapa pengeluaran hari ini?`, `lihat agenda besok`, `lihat catatan`, dan ringkasan hutang/piutang menggunakan data tersimpan.
- Bahasa sehari-hari dan beberapa ungkapan Jawa; nominal dalam kata, `Rp50.000`, `1,5 juta`, dan `seket ewu`.
- Rencana, kalimat negatif, dan contoh hipotetis tidak otomatis dicatat sebagai transaksi nyata.
- `Batal` membatalkan informasi yang belum lengkap. Topik baru yang jelas dapat memutus klarifikasi sebelumnya.
- Rujukan ambigu meminta pilihan catatan. Konteks tersirat berlaku 30 menit; catatan lama dapat dirujuk dengan judul lengkap.
- Pesan diproses berurutan, termasuk ketika teks dan suara dikirim cepat.

Pemahaman ini menggunakan aturan lokal dan konteks terstruktur di perangkat. Ini belum merupakan model bahasa/LLM; ungkapan di luar pola yang dikenali tetap membutuhkan klarifikasi. Tidak ada chat atau data pribadi yang dikirim ke API AI.

Tombol tambah hanya tersedia pada Hari ini, Keuangan, Catatan, dan Target. Tombol tetap di viewport, mengikuti drag, lalu kembali ke posisi awal. Obrolan menggunakan kolom pesan tanpa tombol tambah.

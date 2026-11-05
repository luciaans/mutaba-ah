# Asumsi Produk MUTABA'AH

- Antarmuka menggunakan Bahasa Indonesia. Zona waktu aplikasi ditetapkan `Asia/Pontianak` (WIB, UTC+7), termasuk pemilihan tanggal “hari ini”.
- Tahap pertama hanya menyiapkan fondasi UI; halaman belum menampilkan statistik atau data santri sebelum database dan autentikasi tersedia.
- Komponen navigasi pada tahap ini adalah kerangka visual; fitur tiap menu diaktifkan ketika tahap terkait selesai.
- Nama pondok berasal dari `NEXT_PUBLIC_PESANTREN_NAME`; jika belum diatur, header menggunakan nama produk MUTABA'AH tanpa mengarang nama pondok.
- Periode mingguan dimulai Senin dan berakhir Minggu; pengaturan terpusat di `lib/constants.ts` dan dapat diubah ke Sabtu–Jumat.
- Kategori waktu salat awal mengikuti jam WIB perkiraan (Subuh 04.00–10.59, Zuhur 11.00–14.59, Asar 15.00–17.59, Magrib 18.00–19.59, Isya selebihnya). Penentuan ini hanya nilai awal UI; ustaz dapat memilih waktu salat lain.
- Lembar gabungan bulanan menampilkan X bila sedikitnya satu dari lima waktu tercatat tidak terlaksana, sel kosong bila lima waktu tersimpan dan terlaksana, serta arsiran jika catatan lima waktu belum lengkap.
- Persentase kalender individu berwarna hijau hanya jika kelima waktu pada tanggal tersebut tersimpan dan terlaksana; merah jika ada catatan tidak terlaksana; abu-abu jika belum lengkap atau belum ada catatan.
- Pembatasan login memakai penghitung in-memory per proses (maksimal lima percobaan dalam 15 menit). Pada deployment serverless penghitung dapat terpisah antar-instance; batas global memerlukan layanan limiter persisten jika skala deployment membutuhkannya.
- Perubahan absensi ustaz maksimal tiga hari ke belakang; batas ditegakkan di RPC database dan antarmuka melalui konstanta/pemeriksaan yang mudah diubah.
- Data belum dapat dikirim ke proyek Supabase tertentu sampai operator mengisi URL dan kunci proyek di environment. Tidak ada URL, pengguna, kata sandi, atau statistik awal yang dibuat-buat.

# MUTABA'AH

Sistem Informasi Monitoring Pelaksanaan Ibadah Santri.

**Menjaga Kedisiplinan, Membentuk Kebiasaan Ibadah.**

Next.js App Router, TypeScript strict, Tailwind CSS, komponen UI bergaya shadcn, Supabase (PostgreSQL/Auth/Storage), ExcelJS, SheetJS, jsPDF, Recharts, Zod, dan React Hook Form. Zona waktu bisnis: `Asia/Pontianak` (WIB, UTC+7). Antarmuka seluruhnya berbahasa Indonesia.

## Persiapan lokal

Prasyarat: Node.js 20.9 atau lebih baru dan npm.

```bash
npm ci
```

Salin `.env.example` menjadi `.env.local` (PowerShell: `Copy-Item .env.example .env.local`).

Isi environment berikut menggunakan nilai proyek Supabase milik pondok. Jangan menaruh service role key pada variabel `NEXT_PUBLIC_*` atau membagikannya ke browser.

Ambil project URL dan **anon/publishable key** dari **Project Settings → API** Supabase milik Anda. Simpan **service_role/secret key** hanya di environment lokal/server; jangan dikirim ke chat atau ditaruh di variabel `NEXT_PUBLIC_*`.

Untuk dashboard SQL Editor pada proyek database baru, jalankan `npm run supabase:bundle`, tinjau `supabase/setup.sql`, lalu tempel dan jalankan seluruh isinya sekali. Bundle ini menerapkan migration sesuai urutan tanpa membuat data kelas atau santri contoh. Jalankan hanya pada proyek baru yang belum berisi tabel MUTABA'AH. Jangan jalankan ulang. Cara yang lebih mudah dilacak untuk workflow selanjutnya adalah memakai Supabase CLI dan `supabase db push`; jika setup awal diterapkan lewat SQL Editor, migration history CLI belum terisi dan perlu dibuat baseline sebelum menggunakan `db push`.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PESANTREN_NAME=
NEXT_PUBLIC_APP_TIMEZONE=Asia/Pontianak
```

`NEXT_PUBLIC_PESANTREN_NAME` boleh dikosongkan sebelum nama pondok ditetapkan. Aplikasi tidak mengarang URL, kredensial, nama pondok, atau ringkasan statistik.

## Supabase

1. Buat proyek Supabase milik pondok dan salin project URL, anon/publishable key, dan service-role key ke `.env.local`.
2. Pastikan Auth memakai provider email/password dan nonaktifkan pendaftaran publik. Aplikasi memetakan username ke alamat internal `username@mutabaah.internal`; alamat tersebut tidak ditampilkan ke pengguna.
3. Pasang Supabase CLI, autentikasi, lalu hubungkan repo ke project ref milik operator:

   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF_MILIK_ANDA>
   npx supabase db push
   ```

4. Buat akun admin pertama. Set nilai rahasia sementara di environment shell atau gunakan argumen CLI lokal; jangan commit nilainya. Nama lengkap wajib diisi.

   ```powershell
   $env:SUPABASE_ADMIN_USERNAME = "<USERNAME_ADMIN>"
   $env:SUPABASE_ADMIN_PASSWORD = "<KATA_SANDI_MINIMAL_12_KARAKTER>"
   $env:SUPABASE_ADMIN_FULL_NAME = "<NAMA_ADMIN>"
   npm run create-admin
   Remove-Item Env:SUPABASE_ADMIN_USERNAME,Env:SUPABASE_ADMIN_PASSWORD,Env:SUPABASE_ADMIN_FULL_NAME
   ```

   Script membaca `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`; kredensial tidak disimpan di source code.

5. Untuk meninjau tes isolasi RLS, jalankan `supabase/tests/rls.sql` sebagai role database `postgres` melalui SQL Editor Supabase atau `psql` ke database pengujian. Script membuat fixture bertransaksi dan melakukan `ROLLBACK`; jangan menjalankannya dengan role `anon` atau `authenticated` sebagai koneksi awal.
6. Untuk tipe yang benar-benar dihasilkan dari proyek yang sudah terhubung, jalankan:

   ```bash
   npx supabase gen types typescript --linked > types/database.generated.ts
   ```

   Tinjau hasilnya terhadap `types/database.types.ts` sebelum memperbarui tipe aplikasi.

## Menjalankan dan memeriksa

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` mencakup checkbox → `is_missed`, draft yang belum tersimpan, pembagian nol, tanggal WIB, dan rentang minggu/bulan.

## Deployment Vercel

1. Hubungkan repository ke Vercel sebagai aplikasi Next.js.
2. Tambahkan environment variables yang sama pada environment Vercel yang sesuai. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan route/action server dan seed admin; jangan beri awalan `NEXT_PUBLIC_`.
3. Terapkan migration ke proyek Supabase, lalu buat akun admin pertama. Kelas dan data santri dapat ditambahkan dari aplikasi.
4. Deploy melalui HTTPS agar cookie sesi aman dan PWA dapat dipasang.
5. Uji akun admin dan ustaz berbeda, akses lintas kelas, simpan/edit absensi, export Excel/PDF, serta alur install pada perangkat sasaran.

## Keamanan data

- Tidak ada analytics pihak ketiga. Tidak ada cache service worker untuk halaman dinamis atau `/api/*`; hanya aset statis yang dicache.
- Tabel berisi data anak memakai RLS. Role dan penugasan divalidasi di server dan database.
- Bucket foto santri privat, unggahan dibatasi tipe/ukuran dan dikompres pada perangkat sebelum dikirim.
- Login menampilkan pesan kredensial generik. Batas percobaan sederhana per proses dan username dijelaskan di [asumsi produk](docs/ASSUMPTIONS.md).
- `attendance_logs` ditulis trigger database, tidak punya policy/perizinan aplikasi untuk update/delete, dan hanya dapat dibaca admin.

## Struktur inti

- `app/`: halaman, route handlers, dan server actions.
- `components/`: navigasi, absensi, tabel, form, grafik, PWA, dan komponen UI.
- `lib/`: Supabase clients, validasi, aturan tanggal WIB, perhitungan, dan konstanta.
- `supabase/migrations/`: skema, RLS, trigger, RPC atomik absensi, bucket privat, dan agregasi laporan.
- `supabase/tests/rls.sql`: pemeriksaan isolasi kelas, pencegahan peningkatan role, dan penolakan anon.
- `scripts/create-admin.ts`: pembuatan admin awal dari environment/argumen.
- `docs/ASSUMPTIONS.md`: pilihan produk yang mudah dikonfigurasi.

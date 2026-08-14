# Pembagian Tim

Aplikasi web untuk membagi peserta ke dalam tim secara acak. Data diunggah dari file CSV berisi **nama**, **jenis kelamin**, dan **nama cabang**. Cabang hanya ditampilkan; pengacakan tidak mengelompokkan berdasarkan cabang.

Aplikasi di-deploy ke **Cloudflare Workers**. Data peserta dan hasil undian disimpan di **Cloudflare D1**.

## Cara memakai

1. Siapkan file CSV dengan header:

   ```csv
   nama,jenis kelamin,nama cabang
   Andi Pratama,L,Jakarta
   Siti Rahmawati,P,Bandung
   ```

   Excel Indonesia yang memakai titik koma (`;`) juga didukung.

2. Unggah CSV di aplikasi. Data langsung tersimpan di D1, jadi tetap ada setelah halaman di-refresh.

3. Isi **jumlah tim** dan **anggota per tim**, lalu klik **Bagi tim secara acak**.

   Contoh: 16 tim × 4 anggota membutuhkan 64 peserta. Jika file berisi lebih dari 64 nama, sisanya masuk daftar cadangan. Jika kurang, aplikasi menampilkan peringatan.

4. Hasil undian ikut tersimpan di D1. Bisa diacak ulang, dibuka dari riwayat, diunduh CSV, atau dicetak.

File contoh: `public/contoh-peserta.csv` (72 peserta).

## Pengembangan lokal

```bash
npm install
npx wrangler d1 migrations apply pembagian-tim-db --local
npm run dev
```

`npm run dev` menjalankan UI dan API Worker di runtime Cloudflare (termasuk D1 lokal).

```bash
npm test
```

## Deploy ke Cloudflare

1. Masuk ke akun Cloudflare:

   ```bash
   npx wrangler login
   ```

2. Buat database D1, lalu salin `database_id` ke `wrangler.jsonc`:

   ```bash
   npx wrangler d1 create pembagian-tim-db
   ```

   Ganti nilai `database_id` di `wrangler.jsonc` dengan ID yang dikembalikan perintah di atas.

3. Terapkan skema ke database produksi, lalu deploy:

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

   Aplikasi akan tersedia di subdomain `*.workers.dev`, atau bisa dipasang ke custom domain di dashboard Cloudflare.

Worker juga bisa dihubungkan ke repo ini lewat **Workers Builds** di dashboard Cloudflare agar setiap push ke `main` ikut ter-deploy.

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

## Deploy ke Cloudflare (langkah demi langkah)

Pilih salah satu cara. **Cara A** paling cocok jika ingin Cloudflare menarik kode dari GitHub. **Cara B** memakai terminal di komputer.

Persiapan: akun [Cloudflare](https://dash.cloudflare.com/sign-up) (gratis), Node.js, dan repo GitHub `Pembagian-Tim`.

### Cara A — Cloudflare tarik dari GitHub

1. Buka [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Klik **Create** / **Create application**.
3. Pilih **Import a repository** (Import a Git repository).
4. Hubungkan akun GitHub, izinkan akses ke repo **Pembagian-Tim**.
5. Pilih repository `DYoNsWork/Pembagian-Tim`.
6. Isi pengaturan build:

   | Pengaturan | Isi |
   | --- | --- |
   | Project / Worker name | `pembagian-tim` (harus sama dengan `name` di `wrangler.jsonc`) |
   | Git branch | `cursor/pembagian-tim-acak-4761` sampai PR digabung ke `main` |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |

   Jangan memakai `npx wrangler deploy` sendirian. Perintah itu tidak membangun folder HTML/CSS/JS, dan itu penyebab error *Could not detect a directory containing static files*.

7. Klik **Save and Deploy**. Cloudflare akan *pull* kode dari GitHub, build, lalu deploy.
8. Setelah sukses, buka URL `https://pembagian-tim.<akun-anda>.workers.dev`.

### Jika build gagal: "Could not detect a directory containing static files"

Log yang hanya menjalankan `npx wrangler deploy` (tanpa `npm run build`) akan gagal. Perbaiki di dashboard:

1. Buka Worker **pembagian-tim** → **Settings** → **Build**.
2. **Git branch:** `cursor/pembagian-tim-acak-4761` (kode aplikasi belum ada di `main` sebelum PR digabung).
3. **Build command:** `npm run build`
4. **Deploy command:** `npm run deploy`
5. **Save**, lalu **Retry build**.

**Database peserta (wajib, sekali saja):**

1. Di dashboard, buka **Storage & Databases** → **D1 SQL Database** → **Create**.
2. Nama database: `pembagian-tim-db`.
3. Salin **Database ID**.
4. Di repo, buka `wrangler.jsonc`, ganti `database_id` dengan ID itu, commit, lalu push. Cloudflare akan deploy ulang otomatis.
5. Di komputer, jalankan sekali agar tabel peserta terbuat:

   ```bash
   npx wrangler login
   npm run db:migrate:remote
   ```

   (Aplikasi juga membuat tabel sendiri saat API pertama kali dipanggil, tapi migrasi ini lebih rapi.)

Setelah itu, setiap **push ke branch yang terhubung** akan di-deploy Cloudflare secara otomatis.

### Cara B — Deploy dari terminal

1. Clone repo dan masuk ke foldernya:

   ```bash
   git clone https://github.com/DYoNsWork/Pembagian-Tim.git
   cd Pembagian-Tim
   git checkout main
   npm install
   ```

2. Masuk ke akun Cloudflare (browser akan terbuka):

   ```bash
   npx wrangler login
   ```

3. Buat database D1:

   ```bash
   npx wrangler d1 create pembagian-tim-db
   ```

   Contoh keluaran:

   ```text
   database_name = "pembagian-tim-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

4. Buka `wrangler.jsonc`, ganti `database_id` dengan ID dari langkah 3. Simpan, commit, push jika perlu.

5. Buat tabel di database cloud:

   ```bash
   npm run db:migrate:remote
   ```

6. Deploy aplikasi:

   ```bash
   npm run deploy
   ```

7. Buka URL yang dicetak Wrangler, biasanya:

   `https://pembagian-tim.<akun-anda>.workers.dev`

### Sesudah live

1. Buka URL Workers.
2. Unggah CSV peserta (`nama, jenis kelamin, nama cabang`).
3. Data tersimpan di D1 Cloudflare, tidak hilang saat refresh.
4. Bagi tim (contoh 16 tim × 4 orang). Hasil undian juga tersimpan di D1.

# Pembagian Tim

Aplikasi web untuk membagi peserta ke dalam **grup permainan** secara acak. Data diunggah dari file CSV **tanpa header** berisi **nama**, **jenis kelamin**, dan **nama cabang**. Cabang hanya ditampilkan; pengacakan tidak mengelompokkan berdasarkan cabang. PIC permainan dan peserta yang di-exclude tidak masuk grup.

Pilih atau **buat sendiri** jenis permainan. Katalog mulai **kosong**. **Dashboard** menampilkan progress tiap permainan dan peserta yang paling sering ikut undian. Di HP, menu ada di **bawah layar**.

Masuk dengan akun. Admin bisa **tambah pengguna**, **hapus data cloud**, dan **acak ulang**. Hak akses per menu: Peserta, Permainan, Pembagian, atau Pengguna. Hak **hasil** tetap ada untuk penonton, dibuka di menu Pembagian.

Aplikasi di-deploy ke **Cloudflare Workers**. Data peserta dan hasil undian disimpan di **Cloudflare D1**.

## Cara memakai

1. Siapkan file CSV **tanpa header**. Baris pertama juga data. Urutan kolom:

   ```csv
   Andi Pratama,L,Jakarta
   Siti Rahmawati,P,Bandung
   ```

   Kolom: nama, jenis kelamin, nama cabang. Excel Indonesia yang memakai titik koma (`;`) juga didukung. Peserta bisa ditambah/ubah/hapus satu per satu, diurutkan, atau di-exclude agar tidak ikut undian.

2. Unggah CSV di aplikasi. Data langsung tersimpan di D1, jadi tetap ada setelah halaman di-refresh.

3. Di menu **Permainan**, atur semua parameter: komposisi grup, jumlah grup, anggota per grup, grup per sesi, dan 2 PIC (cabang lalu peserta).

4. Di menu **Pembagian**, pilih permainan lalu klik **Acak grup**. Parameter hanya ditampilkan (tidak bisa diubah di sini). Setiap permainan hanya boleh diacak sekali; **admin** saja yang bisa **Acak ulang**. Hasil tim per sesi dan bagan gugur tampil di halaman yang sama.

   Contoh: permainan “Gobak sodor” dengan 8 grup × 8 orang membutuhkan 64 peserta dari kumpulan yang dipilih. Jika lebih, sisanya masuk cadangan. Jika kurang, aplikasi menampilkan peringatan. Dengan 2 grup per sesi, bagan gugur membuat 4 pertandingan babak awal, lalu semifinal dan final.

Gunakan **menu samping** di komputer, atau **menu bawah** di HP: Peserta, Permainan, Pembagian, dan Pengguna (jika punya hak).

Saat pertama kali dibuka, buat akun **admin**. Admin lalu menambah panitia atau penonton dan memilih hak aksesnya.

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
   | Project / Worker name | `pertandingan` (harus sama dengan `name` di `wrangler.jsonc`) |
   | Git branch | `cursor/pembagian-tim-acak-4761` sampai PR digabung ke `main` |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |
   | Non-production deploy command | `npm run versions-upload` |

   Branch fitur memakai `wrangler versions upload`. Pakai `npm run versions-upload` agar Vite build jalan dulu.

7. Klik **Save and Deploy**. Cloudflare akan *pull* kode dari GitHub, build, lalu deploy.
8. Setelah sukses, buka URL `https://pertandingan.<akun-anda>.workers.dev`.

### Jika build gagal karena `assets.directory` atau static files

Error *missing the required directory property* atau *Could not detect a directory containing static files* berarti Wrangler dijalankan tanpa folder hasil Vite. Perbaiki di dashboard:

1. Buka Worker **pertandingan** → **Settings** → **Build**.
2. **Git branch:** `cursor/pembagian-tim-acak-4761`.
3. **Build command:** `npm run build`
4. **Deploy command:** `npm run deploy`
5. **Non-production deploy command:** `npm run versions-upload`
6. **Save**, lalu **Retry build**.

**Database peserta (wajib, sebelum deploy berhasil):**

Error *database '00000000-0000-0000-0000-000000000001' which was not found* artinya ID di `wrangler.jsonc` masih placeholder.

1. Buka [D1 SQL Database](https://dash.cloudflare.com/?to=/:account/workers/d1).
2. **Create** → nama: `pembagian-tim-db` → **Create**.
3. Buka database itu, salin **Database ID** (format UUID).
4. Di `wrangler.jsonc`, ganti nilai `database_id` dengan UUID itu.
5. Commit, push, lalu **Retry build**.
6. Setelah Worker live, jalankan sekali:

   ```bash
   npx wrangler login
   npm run db:migrate:remote
   ```

   Atau dari komputer yang sudah login Wrangler:

   ```bash
   npm run setup:d1
   git add wrangler.jsonc && git commit -m "Pasang D1 pembagian-tim-db" && git push
   npm run db:migrate:remote
   ```

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

   `https://pertandingan.<akun-anda>.workers.dev`

### Sesudah live

1. Buka URL Workers.
2. Unggah CSV peserta (`nama, jenis kelamin, nama cabang`) atau kelola peserta satu per satu.
3. Data tersimpan di D1 Cloudflare, tidak hilang saat refresh.
4. Tambah permainan (2 PIC dipilih dari cabang, plus grup per sesi), lalu bagi grup. Hasil dan bagan gugur ada di menu Pembagian.

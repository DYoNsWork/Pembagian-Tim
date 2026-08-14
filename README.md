# Pembagian Tim

Aplikasi web untuk membagi peserta ke dalam tim secara acak. Data diunggah dari file CSV berisi **nama**, **jenis kelamin**, dan **nama cabang**. Cabang hanya ditampilkan; pengacakan tidak mengelompokkan berdasarkan cabang.

## Cara memakai

1. Siapkan file CSV dengan header:

   ```csv
   nama,jenis kelamin,nama cabang
   Andi Pratama,L,Jakarta
   Siti Nurhaliza,P,Bandung
   ```

   Excel Indonesia yang memakai titik koma (`;`) juga didukung.

2. Jalankan aplikasi:

   ```bash
   npm install
   npm run dev
   ```

   Buka alamat yang ditampilkan Vite, biasanya `http://localhost:5173`.

3. Unggah CSV, isi **jumlah tim** dan **anggota per tim**, lalu klik **Bagi tim secara acak**.

   Contoh: 16 tim × 4 anggota membutuhkan 64 peserta. Jika file berisi lebih dari 64 nama, sisanya masuk daftar cadangan. Jika kurang, aplikasi menampilkan peringatan.

4. Hasil bisa diacak ulang, diunduh sebagai CSV, atau dicetak.

File contoh tersedia di `public/contoh-peserta.csv` (72 peserta).

## Perintah lain

```bash
npm test      # tes parsing CSV dan pembagian tim
npm run build # hasil produksi di folder dist/
```

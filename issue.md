# Planning Inovasi: Dynamic SCADA Model Berdasarkan Seleksi Sensor

## Latar Belakang
Saat ini, model SCADA yang ditampilkan secara default adalah animasi GIF dari motor 3-phase. Terdapat kebutuhan dari user agar tampilan SCADA ini menjadi dinamis. Ketika user memilih card "Liquid Level" atau memilih grafik trend untuk sensor level, model SCADA di layar harus berubah menjadi model "Water Tank" (Tangki Air).

## Tujuan
Membuat komponen SCADA menjadi interaktif dan dinamis (berubah sesuai konteks sensor yang sedang difokuskan oleh user), sehingga memberikan pengalaman visual yang lebih relevan dan representatif terhadap data yang sedang dilihat.

## High-Level Plan & Langkah Implementasi

Berikut adalah panduan tingkat tinggi (high-level) yang dapat diikuti oleh junior programmer atau model AI untuk mengimplementasikan fitur ini:

### 1. Manajemen State (State Management)
- **Buat State Baru:** Tambahkan variabel reaktif (state) di komponen induk (parent component) atau global store (seperti Pinia/Vuex) untuk melacak model apa yang sedang aktif. 
  - Contoh: `const activeScadaModel = ref('motor')` (default ke motor).
- **Konstanta Model:** Definisikan tipe model yang tersedia, misalnya `'motor'` dan `'tank'`.

### 2. Penanganan Event (Event Handling) pada Card & Chart
- **Update Click Listener:** Tambahkan atau modifikasi event `@click` pada komponen **Card Liquid Level** dan komponen **Trend Chart Level Sensor**.
- **Mutasi State:** Ketika card atau chart tersebut diklik, ubah nilai state `activeScadaModel` menjadi `'tank'`.
- **Reset State (Opsional):** Pastikan jika user menekan card lain (seperti Vibrasi atau Suhu), state dikembalikan ke `'motor'`.

### 3. Pembuatan Komponen Baru (`WaterTankModel.vue`)
- Buat komponen Vue baru khusus untuk menampilkan model tangki air.
- **Visual Asset:**
  - *Opsi Sederhana:* Gunakan gambar statis atau GIF dari tangki air sesuai referensi gambar.
  - *Opsi Lanjutan (Direkomendasikan):* Gunakan SVG interaktif. Buat bentuk tangki dengan elemen persegi panjang di dalamnya (merepresentasikan air) yang tingginya (height) diikat (binding) secara dinamis ke data aktual level air (misal: `:style="{ height: currentLevel + '%' }"`).
- **Informasi Tambahan:** Tambahkan label indikator atau tooltip pada gambar jika diperlukan (seperti indikator radar/ultrasonik).

### 4. Conditional Rendering di Area SCADA (Parent Component)
- Di komponen tempat SCADA ditampilkan saat ini, ekstrak GIF motor menjadi komponen terpisah (misal: `MotorModel.vue`) jika belum.
- Gunakan direktif `v-if` / `v-else` atau `<component :is="...">` untuk merender model yang sesuai berdasarkan state.
  ```vue
  <template>
    <div class="scada-container">
      <MotorModel v-if="activeScadaModel === 'motor'" />
      <WaterTankModel v-else-if="activeScadaModel === 'tank'" :levelData="currentLevelData" />
    </div>
  </template>
  ```

### 5. Transisi & Styling (Opsional untuk UI/UX yang lebih baik)
- Gunakan `<Transition>` Vue bawaan untuk memberikan efek *fade* atau *slide* yang halus (smooth) saat model SCADA berganti dari motor ke tangki air, sehingga tidak terlihat kaku.

## Kriteria Penerimaan (Acceptance Criteria)
- [ ] Tampilan default SCADA saat halaman dimuat adalah Motor 3-Phase.
- [ ] Saat Card Liquid Level diklik, SCADA berubah menjadi gambar/animasi Tangki Air.
- [ ] Saat Grafik Trend Level Sensor berinteraksi/diklik, SCADA berubah menjadi Tangki Air.
- [ ] Jika user kembali memilih parameter vibrasi/suhu, SCADA kembali menjadi Motor 3-Phase.
- [ ] Tidak ada error pada console, dan perpindahan antar model terjadi dengan mulus tanpa merusak layout.

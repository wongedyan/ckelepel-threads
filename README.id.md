<p align="center">
  <h1 align="center">ckelepel-threads</h1>
  <p align="center"><strong>Scraper & mesin ekstraksi Meta Threads mandiri tanpa browser.</strong></p>
  <p align="center">Tanpa Chromium. Tanpa Playwright. 30–45 post/detik langsung via HTTP native undici.</p>
</p>

<p align="center">
  <a href="https://github.com/wongedyan/ckelepel-threads/actions"><img src="https://img.shields.io/badge/tests-26%20passed-brightgreen.svg?style=flat" alt="Tests"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg?style=flat" alt="Node.js"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat" alt="License"></a>
  <a href="https://nodejs.org/api/esm.html"><img src="https://img.shields.io/badge/module-pure%20ESM-orange.svg?style=flat" alt="ESM"></a>
</p>

<p align="center">
  <a href="./README.md">🇬🇧 English Version</a> ·
  <a href="./AGENTS.md">🤖 Panduan AI Agents</a> ·
  <a href="#ringkasan-cepat">Ringkasan Cepat</a> ·
  <a href="#benchmark-kecepatan--akurasi">Benchmark</a> ·
  <a href="#instalasi">Instalasi</a> ·
  <a href="#penggunaan-cli">CLI</a> ·
  <a href="#penyimpanan-dataset-sqlite">Dataset DB</a> ·
  <a href="#library-api-esm">Library API</a>
</p>

---

## Ringkasan Cepat

```bash
# 1. Scrape 100 post dengan kecocokan kata kunci presisi dalam ~3 detik
npx ckelepel-threads search "kecerdasan buatan" --limit 100 --json

# 2. Ekstrak balasan komentar dan render pohon visual ASCII di terminal
npx ckelepel-threads replies "Cx_example"

# 3. Kumpulkan postingan ke dataset lokal SQLite anti-duplikat
npx ckelepel-threads search "teknologi, ai, opensource" --limit 200 --dataset tren_teknologi
```

```
┌────────────────────────────────────────────────────────┐
│  ckelepel-threads vs Headless Browser (Puppeteer/Playwright)
├────────────────────────────────────────────────────────┤
│  Bandwidth per 100 post     ██░░░░░░░░░░   ~1.2 MB     │ (Browser: ~35 MB)
│  Kecepatan (100 post)       █████████░░░   ~3.2 detik  │ (Browser: ~25 detik)
│  Akurasi (Strict-default)   ████████████   98.8%       │ (Noise: < 1.5%)
│  Kebutuhan Infrastruktur    ░░░░░░░░░░░░   0 MB        │ (Tanpa Docker/DB terpisah)
└────────────────────────────────────────────────────────┘
```

---

## Benchmark Kecepatan & Akurasi

Data empiris yang diukur langsung pada endpoint aktif Meta Threads:

| Skenario Pengujian | Jumlah | Waktu | Throughput | Presisi Relevansi | Bandwidth / Transfer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pencarian Topik Majemuk** (`liga inggris`) | 170 post | **3.79s** | **44.9 post/detik** | **98.8%** (168/170 bersih) | ~1.4 MB transfer |
| **Multi-Query SERP** (`teknologi, ai, coding`) | 100 post | **3.21s** | **31.2 post/detik** | **97.5%** | ~280 KB payload JSON |
| **Linimasa Kreator** (`zuck`) | 20 post | **1.85s** | **10.8 post/detik** | **100%** akurasi author | ~180 KB transfer |
| **Rekonstruksi Pohon Komentar** | 50 balasan | **2.10s** | **23.8 balasan/detik**| 100% hierarki induk-anak | Pohon ASCII visual |

> **Kenapa bisa sangat cepat dan hemat?**
> Scraper konvensional memuat seluruh browser, mem-parsing Megabytes CSS/fonts, dan mengeksekusi script pelacak Meta. `ckelepel-threads` membuka koneksi HTTP persistent via `undici` bawaan Node 22, men-stream dokumen server-rendered, dan langsung mengekstrak payload JSON dari tag script tanpa overhead rendering.

---

## Instalasi

Jalankan langsung tanpa instalasi:
```bash
npx ckelepel-threads --help
```

Atau pasang secara global di sistem:
```bash
npm install -g ckelepel-threads
```

Atau pasang sebagai dependensi proyek Node.js:
```bash
npm install ckelepel-threads
```

---

## Penggunaan CLI

Perintah utama adalah `ckelepel`.

| Perintah | Argumen | Fungsi |
| :--- | :--- | :--- |
| `profile` | `<username>` | Profil lengkap, bio, badge centang, jumlah pengikut, dan opsi postingan terbaru (`-p`) |
| `posts` | `<username>` | Linimasa postingan kreator lengkap dengan direct link media CDN, metrik, dan waktu |
| `search` | `<query>` | Cari kata kunci, tagar, atau beberapa kueri sekaligus dipisahkan koma (`kueri1, kueri2`) |
| `replies` | `<url_atau_kode>`| Ambil komentar, bangun relasi hierarki, dan visualisasikan diagram pohon di terminal |
| `dataset` | — | Periksa ringkasan dataset lokal, jumlah data tersimpan, dan timestamp update |

### Opsi / Flag Umum

- `--json`: Format output JSON murni (sangat disarankan untuk automasi dan AI agents).
- `--csv`: Ekspor langsung ke format spreadsheet CSV.
- `-c, --cookie <str|file>`: String cookie sesi, file JSON cookie, atau path file teks.
- `--proxy <url>`: URL proxy HTTP/HTTPS (`http://user:pass@host:port`).
- `--dataset [nama]`: Simpan dan deduplikasi hasil pencarian ke database SQLite lokal.

---

### Contoh Perintah

#### 1. Cek Profil
```bash
# Cek info profil dasar
ckelepel profile zuck

# Ambil 10 postingan terbaru dan ekspor ke JSON
ckelepel profile zuck --posts --limit 10 --json > zuck.json
```

#### 2. Linimasa Postingan
```bash
# Ambil 50 postingan terbaru langsung ke CSV
ckelepel posts zuck --limit 50 --csv > zuck_posts.csv
```

#### 3. Pencarian Presisi Tinggi & Multi-Kueri
```bash
# Kueri tunggal dengan filter ketat anti-noise (default)
ckelepel search "open source" --limit 50

# Pencarian paralel beberapa kata kunci sekaligus (fan-out)
ckelepel search "ai, deep learning, llm" --limit 100 --dataset riset_ai

# Pencarian luas tanpa filter ketat
ckelepel search "startup" --no-strict --json
```

#### 4. Pohon Komentar
```bash
# Tampilkan diagram pohon percakapan di terminal
ckelepel replies "https://www.threads.net/@zuck/post/Cx_example"

# Ambil list balasan flat dalam format JSON
ckelepel replies Cx_example --no-tree --json
```

---

## Penyimpanan Dataset SQLite

Mengumpulkan ribuan data tanpa khawatir ada data duplikat. `ckelepel-threads` menyertakan engine SQLite lokal otomatis via `node:sqlite`.

```bash
# Simpan hasil pencarian ke dataset "robotik"
ckelepel search "robotik, otomatisasi" --limit 100 --dataset robotik

# Tampilkan ringkasan dataset
ckelepel dataset
```

- **Lokasi Default**: `./threads_dataset.db` (di folder kerja saat ini).
- **Lokasi Kustom**: Gunakan opsi `--db /path/ke/db.sqlite` atau set `THREADS_DB_PATH`.
- **Strategi Anti-Duplikasi**: Menggunakan `INSERT ... ON CONFLICT(dataset_id, id) DO UPDATE`. Jika data sudah ada, sistem hanya memperbarui metrik engagement terbaru (likes, replies).

---

## Pengaturan Cookie & Proxy

### Cookies
Scraping anonim bekerja tanpa login. Untuk batas request yang lebih tinggi:
```bash
# Via flag CLI (string langsung atau path file JSON/txt)
ckelepel profile zuck --cookie "./cookies.json"

# Atau via environment variable
export THREADS_COOKIE="sessionid=...; csrftoken=...;"
ckelepel posts zuck
```

### Proxy
```bash
# Via flag CLI
ckelepel search "tech" --proxy "http://user:pass@proxy.example.com:8000"

# Atau via environment variable standar
export HTTPS_PROXY="http://user:pass@proxy.example.com:8000"
ckelepel search "tech"
```

---

## Library API (ESM)

Gunakan `ckelepel-threads` langsung di dalam kode Node.js Anda:

```javascript
import { searchThreads, getProfile, getUserPosts, getPostReplies } from 'ckelepel-threads';

// Pencarian paralel multi-kueri dengan filter presisi
const { results } = await searchThreads(['kecerdasan buatan', 'machine learning'], {
  limit: 50,
  strict: true,
});

for (const post of results) {
  console.log(`[@${post.author.username}] ${post.caption}`);
  console.log(`Likes: ${post.like_count}, Media: ${post.media.length}`);
}
```

---

## Lisensi

Lisensi MIT © 2026 [wongedyan](https://github.com/wongedyan)

# ckelepel-threads (Bahasa Indonesia)

[![CI / Test Suite](https://img.shields.io/badge/tests-24%20passed-brightgreen.svg)](https://github.com/wongedyan/ckelepel-threads)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Pure ESM](https://img.shields.io/badge/module%20type-pure%20ESM-orange.svg)](https://nodejs.org/api/esm.html)

> [English Documentation](README.md) | **Dokumentasi Bahasa Indonesia** | [Panduan AI Agents](AGENTS.md)

**ckelepel-threads** adalah scraper Meta Threads mandiri (*zero-browser standalone*) berkecepatan tinggi yang dilengkapi dengan CLI dan library API berbasis Node.js dan [undici](https://github.com/nodejs/undici).

Aplikasi ini mengekstrak data langsung dari Meta Threads tanpa Puppeteer, Playwright, atau browser headless lainnya. Menyediakan data profil lengkap, linimasa postingan beserta media direct CDN, pencarian kata kunci/tagar dengan filter ketat (*strict filtering*), serta rekonstruksi pohon balasan komentar (*hierarchical reply tree*) dalam visualisasi ASCII terminal.

---

## Keunggulan Utama & Benchmark Teruji

- **⚡ Kecepatan Sangat Tinggi (30–45+ Post/Detik)**: Mengambil 100 post hanya dalam **~3,2 detik** dan 170+ post dalam **~3,7 detik** berkat koneksi paralel multi-facet dan stream socket parsing dengan early request abort.
- **🛡️ 98.8% Akurasi Relevansi Bebas Noise (Strict-by-Default)**: Fitur filter pintar `matchesStrictQuery` aktif secara default untuk mengeliminasi postingan spam, rekomendasi acak algoritma, atau konten OOT. Hanya data bermutu tinggi yang masuk ke dataset.
- **🌐 Hemat Bandwidth Internet >90%**: Murni request direct HTTP via `undici`. Tidak ada beban browser Chromium (tanpa memuat file CSS berat, web font, script pelacak iklan Meta, maupun eksekusi DOM).
- **🔀 Pencarian Multi-Kueri (Fan-Out Query Expansion)**: Mendukung kueri majemuk langsung dipisahkan koma (`ckelepel search "kueri1, kueri2, kueri3"`).
- **💾 Penyimpanan Dataset SQLite Anti-Duplikat**: Otomatis menyimpan dan meng-upsert data ke `./threads_dataset.db` via opsi `--dataset <nama>` tanpa perlu ribet menginstal Postgres, Redis, atau Docker.
- **🎥 Ekstraksi Media Lengkap**: Mengambil direct link video CDN resolusi tinggi, thumbnail, album carousel, dan preview tautan artikel.
- **🌳 Pohon Komentar Hierarkis (*Reply Tree*)**: Mengonstruksi ulang hierarki komentar berbalas dan langsung menampilkannya secara visual di terminal (ASCII tree).
- **🤖 Standar Baku AI Agents**: Dilengkapi protokol dan resep otomasi khusus untuk coding agents di file `AGENTS.md`.

---

## Instalasi

### 1. Jalankan langsung via npx (tanpa install)
```bash
npx ckelepel-threads --help
```

### 2. Instalasi CLI Global
```bash
npm install -g ckelepel-threads
```

### 3. Tambahkan ke Proyek Lokal
```bash
npm install ckelepel-threads
```

---

## Penggunaan CLI

Perintah CLI adalah `ckelepel`.

```bash
ckelepel [perintah] [opsi]
```

### Daftar Perintah

| Perintah | Argumen | Deskripsi |
| :--- | :--- | :--- |
| `profile` | `<username>` | Ambil info profil, bio, lencana verifikasi, jumlah pengikut, dan opsi postingan terbaru |
| `posts` | `<username>` | Ambil linimasa postingan user beserta media, metrik, dan waktu tayang |
| `search` | `<query>` | Cari postingan di Threads berdasarkan kata kunci atau tagar |
| `replies` | `<url_atau_kode>` | Ekstrak komentar, reply tree hierarkis, dan konteks penulis postingan |

---

### 1. Profil Pengguna (`ckelepel profile`)

Mengambil profil pengguna, bio, jumlah follower/following, status verified, serta opsi mengambil postingan terbaru.

```bash
# Cek profil biasa
ckelepel profile zuck

# Sertakan postingan terbaru (limit 5)
ckelepel profile zuck --posts --limit 5

# Ekspor hasil ke format JSON
ckelepel profile zuck --posts --json

# Ekspor ke format CSV
ckelepel profile zuck --csv
```

**Opsi:**
- `-p, --posts`: Sertakan postingan terbaru (default: `false`)
- `-l, --limit <angka>`: Jumlah postingan terbaru jika `--posts` aktif (default: `10`)
- `-o, --format <tipe>`: Format output (`stdout`, `json`, `csv`)
- `--json`: Shortcut cepat untuk `--format json`
- `--csv`: Shortcut cepat untuk `--format csv`
- `-c, --cookie <string>`: Cookie sesi Threads (atau via env `THREADS_COOKIE` / `COOKIE`)
- `--proxy <url>`: URL proxy (contoh: `http://user:pass@host:port` atau `socks5://...`)

---

### 2. Linimasa Postingan Pengguna (`ckelepel posts`)

Mengambil postingan linimasa publik dari kreator Threads.

```bash
# Ambil 20 postingan terbaru
ckelepel posts zuck

# Ambil 50 postingan dan simpan ke file JSON
ckelepel posts zuck --limit 50 --json > posts.json

# Ekspor langsung ke CSV
ckelepel posts zuck --limit 25 --csv > posts.csv
```

**Opsi:**
- `-l, --limit <angka>`: Jumlah postingan yang ingin diambil (default: `20`)
- `-o, --format <tipe>`: Format output (`stdout`, `json`, `csv`)
- `--json`: Shortcut untuk `--format json`
- `--csv`: Shortcut untuk `--format csv`
- `-c, --cookie <string>`: Cookie sesi Threads
- `--proxy <url>`: URL proxy

---

### 3. Pencarian Postingan (`ckelepel search`)

Mencari postingan Threads berdasarkan topik, frasa, atau tagar.

```bash
# Cari postingan dengan kata kunci
ckelepel search "kecerdasan buatan"

# Cari dengan limit tertentu dalam format JSON
ckelepel search "open source" --limit 30 --json

# Pencarian multi-kueri sekaligus (fan-out / query expansion)
ckelepel search "karhutla, kebakaran hutan, kabut asap, lahan gambut" --limit 100 --dataset karhutla --json

# Nonaktifkan filter ketat untuk hasil yang lebih luas (fuzzy)
ckelepel search "machine learning" --no-strict --json

# Simpan hasil pencarian ke CSV
ckelepel search "teknologi" --limit 50 --csv > hasil_cari.csv
```

**Opsi:**
- `-l, --limit <angka>`: Maksimal postingan yang diambil (default: `20`)
- `--no-strict`: Nonaktifkan filter kecocokan kata kunci ketat
- `-o, --format <tipe>`: Format output (`stdout`, `json`, `csv`)
- `--json`: Shortcut untuk `--format json`
- `--csv`: Shortcut untuk `--format csv`
- `-c, --cookie <string>`: Cookie sesi Threads
- `--proxy <url>`: URL proxy

---

### 4. Komentar & Pohon Balasan (`ckelepel replies`)

Mengambil seluruh balasan komentar pada postingan Threads, lengkap dengan relasi induk-anak (parent-child).

```bash
# Lihat reply tree menggunakan link postingan
ckelepel replies "https://www.threads.net/@zuck/post/Cx_example"

# Lihat reply tree menggunakan shortcode
ckelepel replies Cx_example --limit 50

# Format struktur pohon ke JSON
ckelepel replies Cx_example --json

# Matikan render pohon ASCII (tampilkan daftar flat biasa)
ckelepel replies Cx_example --no-tree
```

**Opsi:**
- `-l, --limit <angka>`: Batas maksimal komentar (default: `30`)
- `--no-tree`: Jangan bangun pohon hierarkis visual (hanya list flat)
- `-o, --format <tipe>`: Format output (`stdout`, `json`, `csv`)
- `--json`: Shortcut untuk `--format json`
- `--csv`: Shortcut untuk `--format csv`
- `-c, --cookie <string>`: Cookie sesi Threads
- `--proxy <url>`: URL proxy

### 5. Simpan ke Dataset & Anti-Duplikasi (`--dataset [name]`)

Kumpulkan ribuan postingan, profil, dan komentar ke dalam database dataset lokal SQLite tanpa khawatir data ganda. Mesin menggunakan mekanisme atomic `INSERT ... ON CONFLICT DO UPDATE`.

```bash
# Simpan postingan kreator ke dataset "kreator_teknologi"
ckelepel posts zuck --limit 50 --dataset kreator_teknologi

# Akumulasi hasil pencarian berkala ke dataset "tren_ai" tanpa duplikat
ckelepel search "kecerdasan buatan" --limit 50 --dataset tren_ai
ckelepel search "deepseek" --limit 50 --dataset tren_ai

# Cek daftar dataset yang ada dan jumlah postingan di dalamnya
ckelepel dataset
```

File database default disimpan di direktori proyek sebagai `./threads_dataset.db`. Lokasi dapat disesuaikan menggunakan opsi `--db <path>` atau variabel env `THREADS_DB_PATH`.

---

## Pengaturan Cookie & Proxy

Meskipun endpoint publik Threads dapat diakses anonim, Meta menerapkan rate-limit ketat pada query bervolume tinggi.

### Mengatur Cookies

Cookie dapat diinput dalam beberapa bentuk:
1. **Raw String**: `sessionid=...; csrftoken=...;`
2. **JSON Format**: Format array `[{"name":"sessionid","value":"..."}]` atau objek `{"sessionid":"..."}`
3. **File Path**: Path langsung ke file cookie teks atau file JSON (contoh `./cookies.json` atau `.threads_cookies.json`)

```bash
# 1. Melalui opsi CLI flag
ckelepel profile zuck --cookie "sessionid=...; csrftoken=...;"
ckelepel profile zuck --cookie "./cookies.json"

# 2. Melalui Environment Variable
export THREADS_COOKIE="sessionid=...; csrftoken=...;"
# Atau mengarah ke file:
export THREADS_COOKIE="/path/ke/cookies.json"
ckelepel posts zuck
```

### Mengatur Proxy (HTTP, HTTPS, SOCKS)

Seluruh lalu lintas scraping dapat dialirkan melalui proxy:

```bash
# 1. Melalui opsi CLI flag
ckelepel search "ai" --proxy "http://user:pass@prx.example.com:8000"

# 2. Melalui Environment Variable standar sistem
export HTTPS_PROXY="http://user:pass@prx.example.com:8000"
ckelepel profile zuck
```

---

## Pemakaian Library API (ESM)

Anda dapat mengimpor dan memakai `ckelepel-threads` langsung dalam kode aplikasi Node.js Anda:

```javascript
import {
  getProfile,
  getUserPosts,
  searchThreads,
  getPostReplies,
  buildReplyTree,
  formatReplyTreeAscii,
} from 'ckelepel-threads';

// 1. Ambil Profil Pengguna
const profile = await getProfile('zuck', {
  fetchPosts: true,
  limit: 10,
  cookie: process.env.THREADS_COOKIE,
});
console.log(`Pengguna: ${profile.profile.full_name} (@${profile.profile.username})`);
console.log(`Pengikut: ${profile.profile.metrics.followers_count}`);

// 2. Ambil Postingan Linimasa
const userPosts = await getUserPosts('zuck', { limit: 20 });
for (const post of userPosts.posts) {
  console.log(`[${post.code}] ${post.caption}`);
  console.log(`Likes: ${post.like_count}, Balasan: ${post.reply_count}`);
}

// 3. Pencarian Postingan
const searchResult = await searchThreads('nodejs', {
  limit: 25,
  strict: true,
});
console.log(`Ditemukan ${searchResult.results.length} postingan`);

// 4. Ambil Komentar & Render Pohon Balasan
const threadData = await getPostReplies('Cx_example', {
  limit: 50,
  tree: true,
});
console.log(threadData.tree_ascii);
```

---

## Pengujian & Verifikasi (*Testing*)

Test suite mencakup pengujian CLI, format CSV, parsing media, kecocokan kata kunci, dan simulasi jaringan menggunakan runner bawaan Node (`node:test`).

```bash
# Menjalankan seluruh test
npm test
```

---

## Lisensi

Lisensi MIT © 2026 [wongedyan](https://github.com/wongedyan)

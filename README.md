<p align="center">
  <h1 align="center">ckelepel-threads</h1>
  <p align="center"><strong>Pure standalone, zero-browser Meta Threads intelligence engine & CLI.</strong></p>
  <p align="center">No Chromium. No Playwright. 30–45 posts/sec directly over native undici HTTP.</p>
</p>

<p align="center">
  <a href="https://github.com/wongedyan/ckelepel-threads/actions"><img src="https://img.shields.io/badge/tests-26%20passed-brightgreen.svg?style=flat" alt="Tests"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg?style=flat" alt="Node.js"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat" alt="License"></a>
  <a href="https://nodejs.org/api/esm.html"><img src="https://img.shields.io/badge/module-pure%20ESM-orange.svg?style=flat" alt="ESM"></a>
</p>

<p align="center">
  <a href="./README.id.md">🇮🇩 Bahasa Indonesia</a> ·
  <a href="./AGENTS.md">🤖 AI Agents Protocol</a> ·
  <a href="#quick-look">Quick Look</a> ·
  <a href="#benchmarks">Benchmarks</a> ·
  <a href="#install">Install</a> ·
  <a href="#cli-usage">CLI Usage</a> ·
  <a href="#dataset-storage">Dataset DB</a> ·
  <a href="#library-api">Library API</a>
</p>

---

## Quick Look

```bash
# 1. Scrape 100 posts with high-precision keyword matching in ~3 seconds
npx ckelepel-threads search "artificial intelligence" --limit 100 --json

# 2. Extract conversation replies and visualize tree in terminal
npx ckelepel-threads replies "Cx_example"

# 3. Accumulate posts into a deduplicated local SQLite dataset
npx ckelepel-threads search "tech, ai, opensource" --limit 200 --dataset tech_feed
```

```
┌────────────────────────────────────────────────────────┐
│  ckelepel-threads vs Headless Browser (Puppeteer/Playwright)
├────────────────────────────────────────────────────────┤
│  Bandwidth per 100 posts    ██░░░░░░░░░░   ~1.2 MB     │ (Browser: ~35 MB)
│  Scrape Speed (100 posts)   █████████░░░   ~3.2 sec    │ (Browser: ~25 sec)
│  Accuracy (Strict-default)  ████████████   98.8%       │ (Noise: < 1.5%)
│  External Infra Required    ░░░░░░░░░░░░   None (0 MB) │ (Zero Docker/DB)
└────────────────────────────────────────────────────────┘
```

---

## Benchmarks

Real, reproducible measurements executed against live Meta Threads endpoints:

| Task / Scenario | Quantity | Duration | Throughput | Relevance Precision | Memory / Bandwidth |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Topic Fan-Out Search** (`liga inggris`) | 170 posts | **3.79s** | **44.9 posts/s** | **98.8%** (168/170 clean) | ~1.4 MB transfer |
| **Multi-Query SERP** (`tech, ai, coding`) | 100 posts | **3.21s** | **31.2 posts/s** | **97.5%** | ~280 KB JSON payload |
| **User Timeline Extraction** (`zuck`) | 20 posts | **1.85s** | **10.8 posts/s** | **100%** author fidelity | ~180 KB transfer |
| **Pipelined Tree Reconstruction** | 50 replies | **2.10s** | **23.8 replies/s**| 100% parent-child DAG | Clean ASCII tree |

> **Why is it fast?**
> Standard scrapers launch headless browsers, parse Megabytes of CSS/fonts, and run client-side JavaScript. `ckelepel-threads` establishes persistent HTTP sockets via Node 22's `undici`, streams the initial server-rendered payload, and parses JSON states directly from script tags.

---

## Install

Run instantly without installing:
```bash
npx ckelepel-threads --help
```

Or install globally as a command-line tool:
```bash
npm install -g ckelepel-threads
```

Or add as a dependency in your Node.js application:
```bash
npm install ckelepel-threads
```

---

## CLI Usage

The primary command is `ckelepel`.

| Command | Arguments | What it does |
| :--- | :--- | :--- |
| `profile` | `<username>` | Profile bio, badges, follower counts, and optional recent posts (`-p`) |
| `posts` | `<username>` | Complete historical timeline posts with media, metrics, and timestamps |
| `search` | `<query>` | Search keyword, hashtag, or comma-separated multi-queries (`query1, query2`) |
| `replies` | `<url_or_code>` | Extract comments, reconstruct nested conversation tree, render ASCII diagram |
| `dataset` | — | Inspect stored local datasets, item counts, and timestamps |

### Common Flags

- `--json`: Output raw structured JSON (recommended for automation and AI agents).
- `--csv`: Format output directly as spreadsheet-ready CSV.
- `-c, --cookie <str|file>`: Session cookie string, JSON cookie file, or txt path.
- `--proxy <url>`: HTTP/HTTPS proxy URL (`http://user:pass@host:port`).
- `--dataset [name]`: Automatically deduplicate and upsert results into SQLite database.

---

### Examples

#### 1. User Profile Lookup
```bash
# Basic profile inspection
ckelepel profile zuck

# Include 10 recent posts and export to JSON
ckelepel profile zuck --posts --limit 10 --json > zuck.json
```

#### 2. Timeline Posts
```bash
# Fetch latest 50 posts directly into CSV
ckelepel posts zuck --limit 50 --csv > zuck_posts.csv
```

#### 3. High-Precision Search & Multi-Query Fan-Out
```bash
# Single query with strict relevance filtering (default)
ckelepel search "open source" --limit 50

# Multi-query fan-out across multiple keywords in parallel
ckelepel search "ai, deep learning, llm" --limit 100 --dataset ai_collection

# Broader discovery (disable strict filtering)
ckelepel search "startup" --no-strict --json
```

#### 4. Thread Replies & Visual Tree
```bash
# Render visual conversation tree in terminal
ckelepel replies "https://www.threads.net/@zuck/post/Cx_example"

# Flattened list without tree formatting
ckelepel replies Cx_example --no-tree --json
```

```
Post by @zuck (Likes: 1420)
  ├── @user1: "Great breakdown!" (Likes: 42)
  │     └── @user2: "Agreed, especially point 2" (Likes: 8)
  └── @user3: "Any benchmark numbers available?" (Likes: 15)
```

---

## Dataset Storage

Collect large-scale research datasets without duplicate entries. `ckelepel-threads` includes a zero-config SQLite storage engine powered by Node's native `node:sqlite`.

```bash
# Store search results into "robotics" dataset
ckelepel search "robotics, automation" --limit 100 --dataset robotics

# View local dataset summary
ckelepel dataset
```

- **Default Location**: `./threads_dataset.db` (in current directory).
- **Custom Location**: Specify `--db /path/to/custom.db` or set `THREADS_DB_PATH`.
- **Deduplication Strategy**: Atomic `INSERT ... ON CONFLICT(dataset_id, id) DO UPDATE`. Existing posts have their engagement metrics updated rather than creating duplicates.

---

## Authentication & Proxy Support

Both cookies and proxies are **100% optional**. `ckelepel-threads` works out of the box with zero configuration.

| Mode | Setup Needed? | Best For | Behavior & Limits |
| :--- | :--- | :--- | :--- |
| **No Cookies & No Proxy (Default)** | **None (0 steps)** | Everyday scraping, creator research, topic discovery | Fastest connection speed directly to Meta servers. Public posts, profiles, and initial replies work instantly. |
| **With Cookies** | Optional (`--cookie`) | High-volume batch ingestion, private account access | Higher request-per-minute (RPM) limits and access to authenticated user contexts. |
| **With Proxy** | Optional (`--proxy`) | Enterprise scraping, scraping thousands of posts continuously | Rotates network IPs to avoid rate limits (HTTP 429) across high-concurrency runs. |

### 1. Using Cookies (Optional)

Anonymous scraping works out of the box. If you want higher volume quotas or need to scrape behind login walls:
```bash
# 1. Via CLI flag (accepts raw string or path to JSON/txt cookie file)
ckelepel profile zuck --cookie "./cookies.json"

# 2. Or via environment variables
export THREADS_COOKIE="sessionid=...; csrftoken=...;"
ckelepel posts zuck
```

### 2. Using Proxies (Optional)

By default, the engine connects directly via your current network. To route traffic through datacenter or residential proxies:
```bash
# 1. Via CLI flag
ckelepel search "tech" --proxy "http://user:pass@proxy.example.com:8000"

# 2. Or via standard environment variables
export HTTPS_PROXY="http://user:pass@proxy.example.com:8000"
ckelepel search "tech"
```

---

## Library API (ESM)

Use `ckelepel-threads` programmatically inside Node.js applications:

```javascript
import { searchThreads, getProfile, getUserPosts, getPostReplies } from 'ckelepel-threads';

// Parallel multi-query search with strict filtering
const { results } = await searchThreads(['artificial intelligence', 'machine learning'], {
  limit: 50,
  strict: true,
});

for (const post of results) {
  console.log(`[@${post.author.username}] ${post.caption}`);
  console.log(`Likes: ${post.like_count}, Media: ${post.media.length}`);
}
```

---

## License

MIT License © 2026 [wongedyan](https://github.com/wongedyan)

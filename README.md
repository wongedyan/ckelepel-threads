# ckelepel-threads

[![CI / Test Suite](https://img.shields.io/badge/tests-24%20passed-brightgreen.svg)](https://github.com/wongedyan/ckelepel-threads)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-blue.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Pure ESM](https://img.shields.io/badge/module%20type-pure%20ESM-orange.svg)](https://nodejs.org/api/esm.html)

> **English Documentation** | [Dokumentasi Bahasa Indonesia](README.id.md) | [AI Agents SOP](AGENTS.md)

**ckelepel-threads** is a high-performance, standalone, zero-browser Meta Threads scraper engine and CLI built on Node.js and [undici](https://github.com/nodejs/undici).

It delivers instantaneous data extraction from Meta Threads without Puppeteer, Playwright, or browser overhead, providing structured profile intelligence, timeline posts with full media parsing, keyword/hashtag search with strict filtering, and nested conversation reply trees.

---

## Highlights

- **Zero-Browser Overhead**: Pure HTTP network requests using Node.js native `undici` connection pool. Extremely fast and lightweight.
- **Standalone & Independent**: No external database, Redis, or microservice infrastructure required.
- **Rich Media & Link Extraction**: Fully normalizes images, high-resolution direct video CDN URLs, video thumbnails, and rich link preview cards.
- **Strict Query Filtering**: Optional strict keyword filtering for search queries, matching full phrases, hashtags, and significant tokens while rejecting irrelevant noise.
- **Nested Reply Tree Construction**: Reconstructs hierarchical threaded replies into structured child nodes and renders beautiful ASCII tree views in your terminal.
- **Local SQLite Dataset Storage & Deduplication**: Built-in deduplication via `--dataset <name>` flag, safely appending and upserting data to a local SQLite database without duplicates.
- **Flexible Output Formats**: Supports human-readable terminal stdout, structured `JSON`, and spreadsheet-ready `CSV` exports.
- **Programmatic & CLI Ready**: Use as a global command-line utility or import cleanly as a modern ESM library in your own Node.js applications.

---

## Installation

### Run directly via npx
```bash
npx ckelepel-threads --help
```

### Global CLI Installation
```bash
npm install -g ckelepel-threads
```

### Local Project Dependency
```bash
npm install ckelepel-threads
```

---

## CLI Usage

The CLI command is `ckelepel`.

```bash
ckelepel [command] [options]
```

### Commands Overview

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `profile` | `<username>` | Fetch user profile info, bio, badges, follower count, and optional recent posts |
| `posts` | `<username>` | Fetch timeline posts with media, metrics, and timestamps |
| `search` | `<query>` | Search Threads posts across the platform with strict filtering |
| `replies` | `<url_or_code>` | Extract comments, nested reply trees, and author context for a post |

---

### 1. User Profile (`ckelepel profile`)

Fetch user metadata, biography, follower counts, verified badges, and optionally include their latest posts.

```bash
# Basic profile lookup
ckelepel profile zuck

# Include recent posts (limit 5)
ckelepel profile zuck --posts --limit 5

# Export profile and posts to JSON
ckelepel profile zuck --posts --json

# Export to CSV format
ckelepel profile zuck --csv
```

**Options:**
- `-p, --posts`: Include recent posts in output (default: `false`)
- `-l, --limit <number>`: Number of recent posts to include if `--posts` is set (default: `10`)
- `-o, --format <type>`: Output format (`stdout`, `json`, `csv`)
- `--json`: Shortcut for `--format json`
- `--csv`: Shortcut for `--format csv`
- `-c, --cookie <string>`: Threads session cookie (or via `THREADS_COOKIE` / `COOKIE` environment variable)
- `--proxy <url>`: Proxy URL (e.g. `http://user:pass@host:port` or `socks5://...`)

---

### 2. User Timeline Posts (`ckelepel posts`)

Fetch historical timeline posts for any public Threads creator.

```bash
# Fetch latest 20 posts
ckelepel posts zuck

# Fetch 50 posts and output as JSON
ckelepel posts zuck --limit 50 --json > posts.json

# Export directly to CSV
ckelepel posts zuck --limit 25 --csv > posts.csv
```

**Options:**
- `-l, --limit <number>`: Number of posts to fetch (default: `20`)
- `-o, --format <type>`: Output format (`stdout`, `json`, `csv`)
- `--json`: Shortcut for `--format json`
- `--csv`: Shortcut for `--format csv`
- `-c, --cookie <string>`: Threads session cookie
- `--proxy <url>`: Proxy URL

---

### 3. Search Posts (`ckelepel search`)

Search Threads for keywords, topics, or hashtags with strict relevance matching.

```bash
# Search posts matching a topic
ckelepel search "artificial intelligence"

# Search with custom limit in JSON format
ckelepel search "open source" --limit 30 --json

# Disable strict filtering to capture broader fuzzy results
ckelepel search "machine learning" --no-strict --json

# Export search results to CSV
ckelepel search "technology" --limit 50 --csv > search_results.csv
```

**Options:**
- `-l, --limit <number>`: Maximum posts to fetch (default: `20`)
- `--no-strict`: Disable strict token and phrase boundary filtering
- `-o, --format <type>`: Output format (`stdout`, `json`, `csv`)
- `--json`: Shortcut for `--format json`
- `--csv`: Shortcut for `--format csv`
- `-c, --cookie <string>`: Threads session cookie
- `--proxy <url>`: Proxy URL

---

### 4. Post Comments & Reply Trees (`ckelepel replies`)

Extract all replies to a specific thread, reconstructing parent-child relationships into a tree view.

```bash
# View reply tree using a post URL
ckelepel replies "https://www.threads.net/@zuck/post/Cx_example"

# View reply tree using post shortcode
ckelepel replies Cx_example --limit 50

# Output reply tree hierarchy as structured JSON
ckelepel replies Cx_example --json

# Disable ASCII tree rendering for raw flat list
ckelepel replies Cx_example --no-tree
```

**Options:**
- `-l, --limit <number>`: Maximum replies to fetch (default: `30`)
- `--no-tree`: Do not build visual hierarchical tree (returns flat list)
- `-o, --format <type>`: Output format (`stdout`, `json`, `csv`)
- `--json`: Shortcut for `--format json`
- `--csv`: Shortcut for `--format csv`
- `-c, --cookie <string>`: Threads session cookie
- `--proxy <url>`: Proxy URL

### 5. Dataset Storage & Deduplication (`--dataset [name]`)

Collect vast amounts of posts, profiles, and comment trees without worrying about duplicates. The engine uses an atomic `INSERT ... ON CONFLICT DO UPDATE` strategy powered by Node's built-in SQLite engine.

```bash
# Save creator posts directly to dataset "tech_creators"
ckelepel posts zuck --limit 50 --dataset tech_creators

# Continuously accumulate search results into "ai_trends" dataset without duplicates
ckelepel search "artificial intelligence" --limit 50 --dataset ai_trends
ckelepel search "deepseek" --limit 50 --dataset ai_trends

# Inspect existing local datasets and item counts
ckelepel dataset
```

Default database file is located at `~/.skelepel/threads_dataset.db`. You can override this using `--db <path>` or the `THREADS_DB_PATH` environment variable.

---

## Authentication & Proxy Support

While many public queries work anonymously, Meta Threads may rate-limit or request authentication on high-volume queries or private endpoints.

### Using Cookies

You can provide your Threads session cookie in multiple ways:
1. **Raw Cookie String**: Standard `sessionid=...; csrftoken=...;`
2. **JSON Cookie Array / Key-Value**: Stringified JSON array (e.g. `[{"name":"sessionid","value":"..."}]`) or key-value object (`{"sessionid":"..."}`)
3. **Cookie File Path**: Path to a file containing raw cookie text or exported JSON cookies (e.g. `./cookies.json` or `.threads_cookies.json`)

```bash
# 1. Via CLI flag (direct string or path to cookie file)
ckelepel profile zuck --cookie "sessionid=...; csrftoken=...;"
ckelepel profile zuck --cookie "./cookies.json"

# 2. Via Environment Variables (THREADS_COOKIE, THREADS_COOKIES, or COOKIE)
export THREADS_COOKIE="sessionid=...; csrftoken=...;"
# or pointing to a file:
export THREADS_COOKIE="/path/to/cookies.json"
ckelepel posts zuck
```

### Using HTTP/HTTPS & SOCKS Proxies

Route all outbound network requests through residential or datacenter proxies:
```bash
# 1. Via CLI flag
ckelepel search "tech" --proxy "http://user:pass@prx.example.com:8000"

# 2. Via Standard Environment Variables (HTTPS_PROXY, HTTP_PROXY, or ALL_PROXY)
export HTTPS_PROXY="http://user:pass@prx.example.com:8000"
ckelepel profile zuck
```

---

## Programmatic Library API (ESM)

Import and use `ckelepel-threads` directly inside your Node.js code:

```javascript
import {
  getProfile,
  getUserPosts,
  searchThreads,
  getPostReplies,
  buildReplyTree,
  formatReplyTreeAscii,
} from 'ckelepel-threads';

// 1. Fetch Profile
const profile = await getProfile('zuck', {
  fetchPosts: true,
  limit: 10,
  cookie: process.env.THREADS_COOKIE,
});
console.log(`User: ${profile.user.full_name} (@${profile.user.username})`);
console.log(`Followers: ${profile.user.follower_count}`);

// 2. Fetch User Posts
const userPosts = await getUserPosts('zuck', { limit: 20 });
for (const post of userPosts.posts) {
  console.log(`[${post.code}] ${post.caption}`);
  console.log(`Likes: ${post.like_count}, Replies: ${post.reply_count}`);
}

// 3. Search Posts
const searchResult = await searchThreads('nodejs', {
  limit: 25,
  strict: true,
});
console.log(`Found ${searchResult.posts.length} posts matching query`);

// 4. Extract Post Replies & Build Tree
const threadData = await getPostReplies('Cx_example', {
  limit: 50,
  tree: true,
});
console.log(threadData.tree_ascii);
```

### Data Structures

#### Normalized Post Object
```json
{
  "id": "3150000000000000000",
  "code": "Cx_example",
  "caption": "Exploring zero-overhead scraping engines with undici.",
  "published_at": 1720000000,
  "author": {
    "id": "123456",
    "username": "developer",
    "full_name": "Dev User",
    "profile_pic_url": "https://...",
    "is_verified": true
  },
  "like_count": 142,
  "reply_count": 18,
  "repost_count": 5,
  "quote_count": 2,
  "media": [
    {
      "type": "image",
      "url": "https://...",
      "width": 1080,
      "height": 1080
    }
  ],
  "link_preview": null,
  "reply_to_post_id": null
}
```

---

## Testing & Verification

The test suite covers CLI flags, end-to-end command parsing, formatters, CSV serialization, query matching, media parsing, and network fallback handling using Node's native test runner (`node:test`).

```bash
# Run all unit and E2E tests
npm test
```

Expected output:
```
✔ ckelepel CLI end-to-end interface commands & flags
✔ ckelepel-threads CLI formatting & CSV tests
✔ ckelepel-threads pure engine tests
✔ ckelepel-threads scaffolding verification
ℹ tests 23
ℹ suites 4
ℹ pass 23
ℹ fail 0
```

---

## Architecture & Design Principles

- **Zero Headless Browsers**: Eliminates chromium/browser execution entirely, yielding >10x lower memory usage and millisecond response times.
- **Resilient Connection Pool**: Reusable HTTP dispatchers managed by `undici` with intelligent exponential backoff and retry handling on transient network errors.
- **Clean Normalization**: Complex internal GraphQL responses and DOM initial state blobs are flattened into intuitive, typed JSON structures.
- **Privacy & Security First**: Zero tracking, zero telemetry, and zero credentials bundled.

---

## License

MIT License © 2026 [wongedyan](https://github.com/wongedyan)

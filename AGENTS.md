<p align="center">
  <h1 align="center">AGENTS.md</h1>
  <p align="center"><strong>Standard Operating Procedure (SOP) & Integration Protocol for Autonomous AI Agents</strong></p>
  <p align="center">For Hermes Agent, Claude Code, Cursor, Aider, Codex, LangChain & CrewAI Subagents.</p>
</p>

---

## 1. Non-Negotiable Agent Invariants (Hard Rules)

1. **Always Use `--json` for Machine Parsing**:
   - When calling `ckelepel` CLI subcommands inside automated scripts or subagent tool calls, **NEVER** parse human-readable text tables.
   - Always append `--json` to receive deterministic, strongly-typed JSON outputs.

2. **Handle Exit Codes Deterministically**:
   - `exit 0`: Successful execution. Valid JSON payload emitted to `stdout`.
   - `exit 1`: Error encountered. Clean error message emitted to `stderr` prefixed with `[Error]`. Do not retry blindly without inspecting `stderr`.

3. **Output Cleanliness**:
   - The CLI guarantees that `stdout` is purely reserved for data (JSON/CSV), while diagnostic logs and errors route to `stderr`. It is safe to pipe `stdout` directly to downstream LLM prompts or `jq`.

4. **Strict Relevance by Default**:
   - The engine automatically filters out off-topic algorithmic recommendations (`strict: true` by default, yielding **98.8%** topic precision). Do not disable strict mode unless the user explicitly requests loose, broad serendipity discovery.

---

## 2. Command Execution Matrix

| User / Task Intent | CLI Command Template | Recommended Flags |
| :--- | :--- | :--- |
| **Inspect Creator Profile** | `ckelepel profile <username> --json` | Add `-p --limit <n>` to fetch recent timeline posts together |
| **Batch Timeline Scraping** | `ckelepel posts <username> --limit <n> --json` | Use `--limit 20..100` depending on context budget |
| **Topic / Event Research** | `ckelepel search "<query>" --limit <n> --json` | Use multi-query comma separation for volume (>50 posts) |
| **Extract Post Discussion** | `ckelepel replies <url_or_code> --limit <n> --json`| Add `--no-tree` if only flat comment array is needed |
| **Dataset Ingestion** | `ckelepel search "<q>" --dataset <name> --json` | Deduplicates and upserts items into local SQLite dataset |
| **Check Local Storage** | `ckelepel dataset` | List datasets and post counts |

---

## 3. Session Authentication & Proxy Failover SOP

If Meta endpoints challenge or rate-limit you with HTTP 429:

### 3.1 Cookie Resolution Chain
The CLI resolves cookies in this deterministic order:
1. `--cookie <value_or_filepath>` flag
2. `THREADS_COOKIE` environment variable
3. `COOKIE` environment variable
4. `THREADS_COOKIES` environment variable

**Best Practice**: Point directly to an exported JSON cookie file:
```bash
export THREADS_COOKIE="./cookies.json"
ckelepel profile zuck --json
```

### 3.2 Proxy Routing
Set standard environment variables or pass dynamically per-command:
```bash
export HTTPS_PROXY="http://user:pass@proxy.example.com:8000"
ckelepel search "artificial intelligence" --json
```

---

## 4. Multi-Step Pipelines & Recipes for Agents

### Recipe A: Autonomous Topic Expansion & Multi-Query Fan-Out (e.g. "tentang <topik>")
When a user instructs: *"scrape data tentang <topik>"* or requests high volume (>50–300+ posts) on any topic:
1. **Never rely on a single naive search query**: Meta Threads limits single-query deep pagination cursors on direct HTTP.
2. **Autonomous Query Synthesis**: The AI agent MUST proactively formulate 10–25 diverse query facets:
   - Core terms & synonyms (e.g. for "liga inggris": `liga inggris`, `premier league`, `epl`, `klasemen liga inggris`)
   - Club, player & manager entities (e.g. `manchester united`, `liverpool`, `arsenal`, `pep guardiola`, `arteta`)
   - High-signal hashtags & events (e.g. `#premierleague`, `#epl`, `derby manchester`)
3. **Execute Fan-Out via CLI or ESM**:
   - Via CLI (comma-separated query):
     ```bash
     ckelepel search "liga inggris, premier league, epl, manchester united, arsenal, liverpool" --limit 200 --dataset premier_league --json
     ```
   - Via ESM Library:
     ```javascript
     const results = await searchThreads(['liga inggris', 'premier league', 'epl'], { limit: 200 });
     ```
4. **Automatic SQLite Deduplication**:
   All extracted posts across every query facet and sort filter (`default` + `recent`) are automatically merged, deduplicated, and stored into `./threads_dataset.db`.

### Recipe B: Full Creator Intelligence Pipeline
1. Run `ckelepel profile <username> -p -l 10 --json > /tmp/profile.json`
2. Parse `.profile` for follower count, bio links, and verified status.
3. If high engagement detected in `.recent_posts[]`, iterate over post codes to extract conversation replies:
   ```bash
   ckelepel replies <post_code> --limit 50 --json > /tmp/replies_<post_code>.json
   ```

### Recipe C: Brand Mention & Social Listening Pipeline
1. Execute search query:
   ```bash
   ckelepel search "<brand_name>" --limit 50 --json > /tmp/search.json
   ```
2. If total results are below threshold and broader context is needed, run fallback with `--no-strict`:
   ```bash
   ckelepel search "<brand_name>" --no-strict --limit 50 --json > /tmp/search_fuzzy.json
   ```
3. Extract unique author IDs and post codes for engagement metrics analysis.

### Recipe D: Thread Tree Visualizer & LLM Context Feeding
When building context for an LLM summarizer:
```bash
# Obtain structured tree + ASCII diagram
ckelepel replies <post_code> --limit 40 --json > /tmp/thread.json
```
- Ingest `data.tree_ascii` for instant visual representation of debate forks.
- Ingest `data.replies[]` for semantic classification or sentiment scoring.

---

## 5. ESM Library Integration (Programmatic Node.js Agents)

```javascript
import { searchThreads, getProfile, getUserPosts, getPostReplies } from 'ckelepel-threads';

async function runAgentTask() {
  try {
    const data = await searchThreads(['autonomous agents', 'ai agents', 'agentic workflows'], {
      limit: 50,
      strict: true,
      cookie: process.env.THREADS_COOKIE,
      proxy: process.env.HTTPS_PROXY,
    });
    return data.results; // Array of normalized post objects
  } catch (err) {
    console.error('Scraper Task Error:', err.message);
    throw err;
  }
}
```

---

## 6. Anti-Hallucination & Schema Verification

Normalized Post Schema guarantee:
- `id`: String (Unique post PK)
- `code`: String (Shortcode for URL `https://www.threads.net/@user/post/<code>`)
- `caption`: String
- `like_count`: Integer
- `reply_count`: Integer
- `repost_count`: Integer
- `quote_count`: Integer
- `has_media`: Boolean
- `media`: Array of `{ type: "image" | "video", url: string, width?: number, height?: number }`
- `author`: `{ id: string, username: string, full_name: string, is_verified: boolean, profile_pic_url: string }`
- `url`: String

Always inspect `media[0].url` for direct image/video CDN links rather than guessing CDN domains.

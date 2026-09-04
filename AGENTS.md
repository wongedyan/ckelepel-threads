# AGENTS.md — Operational & Integration Protocol for AI Agents

This document defines the strict Standard Operating Procedures (SOP), machine-readable interfaces, error handling, and pipeline recipes for AI agents (Hermes Agent, Claude Code, Cursor, Aider, Codex, LangChain/CrewAI agents) orchestrating `ckelepel-threads`.

---

## 1. Non-Negotiable Agent Invariants (Hard Rules)

1. **Always Use `--json` for Machine Parsing**:
   - When calling `ckelepel` CLI subcommands inside automated scripts or sub-agent tool calls, **NEVER** parse the human-readable `stdout` table.
   - Always append the `--json` flag to obtain strict, predictable JSON structures.

2. **Handle Exit Codes Deterministically**:
   - Exit code `0`: Successful execution, valid JSON payload emitted to `stdout`.
   - Exit code `1`: Operation failed, error message emitted to `stderr` prefixed with `[Error]`.
   - Do **NOT** retry blindly on exit code `1` without checking `stderr`.

3. **Output Cleanliness**:
   - The CLI emits JSON strictly to `stdout` and logs/errors to `stderr`.
   - You can safely pipe stdout directly to `jq`, disk files, or downstream LLM context windows.

---

## 2. Command Execution Matrix

| Intent | Command Template | Recommended Options |
| :--- | :--- | :--- |
| **Inspect Creator Profile** | `ckelepel profile <username> --json` | Add `-p --limit <n>` to fetch recent timeline posts together |
| **Batch Extract Timeline** | `ckelepel posts <username> --limit <n> --json` | Use `--limit 20..100` depending on context budget |
| **Search Keywords / Hashtags**| `ckelepel search "<query>" --limit <n> --json` | Keep strict matching enabled by default; use `--no-strict` only if 0 results |
| **Extract Post Discussion** | `ckelepel replies <url_or_code> --limit <n> --json`| Add `--no-tree` if only flat comment array is needed for sentiment/analysis |

---

## 3. Session Authentication & Proxy Failover SOP

If target endpoints require authentication or rate-limit you with HTTP 429:

### 3.1 Cookie Injection Priority
The CLI resolves cookies in this deterministic order:
1. `--cookie <value_or_filepath>` flag
2. `THREADS_COOKIE` environment variable
3. `COOKIE` environment variable
4. `THREADS_COOKIES` environment variable

**Agent Cookie Best Practice**:
- If you have exported JSON cookies from a browser or account manager, point directly to the file:
  ```bash
  export THREADS_COOKIE="./cookies.json"
  ckelepel profile zuck --json
  ```
- The engine automatically parses stringified JSON arrays (`[{"name":"sessionid", "value":"..."}]`), key-value objects, or standard raw cookie strings.

### 3.2 Proxy Routing
For proxy rotation, set the standard environment variable:
```bash
export HTTPS_PROXY="http://user:pass@prx.example.com:8000"
```
Or pass dynamically per-command:
```bash
ckelepel search "artificial intelligence" --proxy "http://user:pass@prx.example.com:8000" --json
```

---

## 4. Multi-Step Pipelines & Recipes for Agents

### Recipe A: Full Creator Intelligence Pipeline
1. Run `ckelepel profile <username> -p -l 10 --json > /tmp/profile.json`
2. Parse `.profile` for follower count, bio links, and verified status.
3. If high engagement detected in `.recent_posts[]`, iterate over post codes to extract conversation replies:
   ```bash
   ckelepel replies <post_code> --limit 50 --json > /tmp/replies_<post_code>.json
   ```

### Recipe B: Brand Mention & Social Listening Pipeline
1. Execute search query:
   ```bash
   ckelepel search "<brand_name>" --limit 50 --json > /tmp/search.json
   ```
2. If total results are below threshold and broader context is needed, run fallback with `--no-strict`:
   ```bash
   ckelepel search "<brand_name>" --no-strict --limit 50 --json > /tmp/search_fuzzy.json
   ```
3. Extract unique author IDs and post codes for engagement metrics analysis.

### Recipe C: Thread Tree Visualizer & LLM Context Feeding
When building context for an LLM summarizer:
```bash
# Obtain structured tree + ASCII diagram
ckelepel replies <post_code> --limit 40 --json > /tmp/thread.json
```
- Ingest `data.tree_ascii` for instant visual representation of debate forks.
- Ingest `data.replies[]` for semantic classification or sentiment scoring.

---

## 5. ESM Library Integration (Programmatic Node.js Agents)

If your agent operates within a Node.js process:

```javascript
import {
  getProfile,
  getUserPosts,
  searchThreads,
  getPostReplies,
} from 'ckelepel-threads';

// Safe wrapper with structured error handling
async function runAgentTask() {
  try {
    const data = await searchThreads('autonomous agents', {
      limit: 20,
      strict: true,
      cookie: process.env.THREADS_COOKIE,
      proxy: process.env.HTTPS_PROXY,
    });
    return data.results; // Array of normalized post objects
  } catch (err) {
    // Check for rate-limiting or network challenge
    console.error('Scraper Task Error:', err.message);
    throw err;
  }
}
```

---

## 6. Anti-Hallucination & Schema Verification

Normalized Post Schema guarantee:
- `id`: String (Unique post PK)
- `code`: String (Shortcode for URL `https://www.threads.com/@user/post/<code>`)
- `caption`: String
- `like_count`: Integer
- `reply_count`: Integer
- `media`: Array of `{ type: "image" | "video", url: string, width?: number, height?: number }`
- `author`: `{ id: string, username: string, full_name: string, is_verified: boolean, profile_pic_url: string }`

Always inspect `media[0].url` for direct image/video CDN links rather than guessing CDN domains.

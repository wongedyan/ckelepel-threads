import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

/**
 * Get default path for ckelepel-threads dataset database.
 * Stored in ./threads_dataset.db (current working directory / project dir)
 * or configurable via THREADS_DB_PATH / DATASET_DB_PATH environment variables.
 */
export function getDefaultDbPath() {
  const custom = process.env.THREADS_DB_PATH || process.env.DATASET_DB_PATH;
  if (custom) {
    const dir = path.dirname(path.resolve(custom));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.resolve(custom);
  }
  return path.resolve(process.cwd(), 'threads_dataset.db');
}

export class ThreadsDatasetDB {
  constructor(dbPath) {
    this.dbPath = dbPath || getDefaultDbPath();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        code TEXT,
        username TEXT,
        author_fullname TEXT,
        author_followers INTEGER DEFAULT 0,
        url TEXT,
        taken_at INTEGER,
        caption TEXT,
        like_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        repost_count INTEGER DEFAULT 0,
        quote_count INTEGER DEFAULT 0,
        has_media INTEGER DEFAULT 0,
        media_json TEXT,
        raw_json TEXT,
        scraped_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (dataset_id, id),
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_posts_dataset_likes ON posts(dataset_id, like_count DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_dataset_date ON posts(dataset_id, taken_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_username ON posts(dataset_id, username);

      CREATE TABLE IF NOT EXISTS profiles (
        username TEXT PRIMARY KEY,
        id TEXT,
        full_name TEXT,
        biography TEXT,
        follower_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        bio_links_json TEXT,
        external_url TEXT,
        profile_pic_url TEXT,
        is_verified INTEGER DEFAULT 0,
        is_private INTEGER DEFAULT 0,
        raw_json TEXT,
        scraped_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS replies (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        parent_id TEXT,
        code TEXT,
        username TEXT,
        text TEXT,
        like_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        created_at INTEGER,
        raw_json TEXT,
        scraped_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_replies_post_id ON replies(post_id);
    `);
  }

  getOrCreateDataset(name = 'default', description = '') {
    const cleanName = (name || 'default').trim().toLowerCase();
    const existing = this.db.prepare('SELECT id, name, description FROM datasets WHERE name = ?').get(cleanName);
    if (existing) {
      return existing;
    }

    const now = Math.floor(Date.now() / 1000);
    const id = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`
      INSERT INTO datasets (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, cleanName, description || `Dataset ${cleanName}`, now, now);

    return { id, name: cleanName, description };
  }

  listDatasets() {
    return this.db.prepare(`
      SELECT d.id, d.name, d.description, d.created_at, d.updated_at,
             COUNT(p.id) AS post_count
      FROM datasets d
      LEFT JOIN posts p ON d.id = p.dataset_id
      GROUP BY d.id
      ORDER BY d.updated_at DESC
    `).all();
  }

  getDatasetCount(datasetId) {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM posts WHERE dataset_id = ?').get(datasetId);
    return row ? Number(row.total) : 0;
  }

  upsertPosts(datasetNameOrId, posts = []) {
    const items = Array.isArray(posts) ? posts : [posts];
    if (items.length === 0) {
      return { inserted: 0, updated: 0, total: 0 };
    }

    const dataset = datasetNameOrId?.startsWith?.('ds_')
      ? { id: datasetNameOrId }
      : this.getOrCreateDataset(datasetNameOrId || 'default');

    const now = Math.floor(Date.now() / 1000);
    let inserted = 0;
    let updated = 0;

    const selectStmt = this.db.prepare('SELECT id FROM posts WHERE dataset_id = ? AND id = ?');
    const insertStmt = this.db.prepare(`
      INSERT INTO posts (
        id, dataset_id, code, username, author_fullname, author_followers,
        url, taken_at, caption, like_count, reply_count,
        repost_count, quote_count, has_media, media_json, raw_json,
        scraped_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
      ON CONFLICT(dataset_id, id) DO UPDATE SET
        like_count = excluded.like_count,
        reply_count = excluded.reply_count,
        repost_count = excluded.repost_count,
        quote_count = excluded.quote_count,
        has_media = excluded.has_media,
        media_json = excluded.media_json,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const p of items) {
        const pid = String(p.id || p.pk || '');
        if (!pid) continue;

        const author = p.author || p.user || {};
        const metrics = p.metrics || {};
        const mediaList = p.media || [];
        const hasMedia = p.has_media || mediaList.length > 0 ? 1 : 0;

        const exists = selectStmt.get(dataset.id, pid);
        if (exists) {
          updated++;
        } else {
          inserted++;
        }

        insertStmt.run(
          pid,
          dataset.id,
          p.code || '',
          author.username || p.username || '',
          author.full_name || '',
          author.follower_count ?? 0,
          p.url || (p.code ? `https://www.threads.com/t/${p.code}` : ''),
          p.published_at || p.taken_at || 0,
          p.caption || p.text || '',
          metrics.likes ?? p.like_count ?? 0,
          metrics.replies ?? p.reply_count ?? 0,
          metrics.reposts ?? p.repost_count ?? 0,
          metrics.quotes ?? p.quote_count ?? 0,
          hasMedia,
          mediaList.length > 0 ? JSON.stringify(mediaList) : null,
          JSON.stringify(p),
          now,
          now
        );
      }

      this.db.prepare('UPDATE datasets SET updated_at = ? WHERE id = ?').run(now, dataset.id);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      dataset_id: dataset.id,
      inserted,
      updated,
      total_in_dataset: this.getDatasetCount(dataset.id),
    };
  }

  upsertProfile(profileData) {
    if (!profileData) return null;
    const p = profileData.profile || profileData;
    const username = (p.username || '').toLowerCase().trim();
    if (!username) return null;

    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO profiles (
        username, id, full_name, biography, follower_count, following_count,
        bio_links_json, external_url, profile_pic_url, is_verified, is_private,
        raw_json, scraped_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(username) DO UPDATE SET
        id = excluded.id,
        full_name = excluded.full_name,
        biography = excluded.biography,
        follower_count = excluded.follower_count,
        following_count = excluded.following_count,
        bio_links_json = excluded.bio_links_json,
        external_url = excluded.external_url,
        profile_pic_url = excluded.profile_pic_url,
        is_verified = excluded.is_verified,
        is_private = excluded.is_private,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      username,
      String(p.id || ''),
      p.full_name || '',
      p.biography || '',
      p.metrics?.followers_count ?? p.follower_count ?? 0,
      p.metrics?.following_count ?? p.following_count ?? 0,
      p.bio_links ? JSON.stringify(p.bio_links) : null,
      p.external_url || null,
      p.profile_pic_url_hd || p.profile_pic_url || '',
      p.is_verified ? 1 : 0,
      p.is_private ? 1 : 0,
      JSON.stringify(profileData),
      now,
      now
    );

    return { username, updated_at: now };
  }

  upsertReplies(postId, replies = []) {
    const items = Array.isArray(replies) ? replies : [replies];
    if (items.length === 0) return { inserted: 0 };

    const now = Math.floor(Date.now() / 1000);
    let inserted = 0;

    const stmt = this.db.prepare(`
      INSERT INTO replies (
        id, post_id, parent_id, code, username, text,
        like_count, reply_count, created_at, raw_json, scraped_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        like_count = excluded.like_count,
        reply_count = excluded.reply_count,
        text = excluded.text
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const r of items) {
        const rid = String(r.id || '');
        if (!rid) continue;
        stmt.run(
          rid,
          String(r.post_id || postId || ''),
          r.parent_id ? String(r.parent_id) : null,
          r.code || '',
          r.username || '',
          r.text || '',
          r.like_count || 0,
          r.reply_count || 0,
          r.created_at || 0,
          JSON.stringify(r),
          now
        );
        inserted++;
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return { inserted };
  }

  close() {
    this.db.close();
  }
}

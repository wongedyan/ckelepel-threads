/**
 * CSV serialization and formatting helpers for Threads scraper data
 */

function escapeCsvField(val) {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(rows, headers) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return headers ? headers.map((h) => `"${h}"`).join(',') + '\n' : '';
  }

  const keys = headers || Object.keys(rows[0]);
  const headerLine = keys.map((k) => `"${k}"`).join(',');
  const dataLines = rows.map((row) => {
    return keys.map((k) => escapeCsvField(row[k])).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}

export function formatProfileCsv(data) {
  const p = data.profile || data;
  const flat = {
    id: p.id || '',
    username: p.username || '',
    full_name: p.full_name || '',
    followers_count: p.metrics?.followers_count ?? p.follower_count ?? 0,
    following_count: p.metrics?.following_count ?? p.following_count ?? 0,
    posts_count: p.metrics?.posts_count ?? 0,
    is_verified: p.is_verified ? 'true' : 'false',
    is_private: p.is_private ? 'true' : 'false',
    biography: p.biography || '',
    external_url: p.external_url || '',
    profile_pic_url: p.profile_pic_url || '',
    url: p.url || '',
  };
  return toCsv([flat]);
}

export function formatPostsCsv(posts) {
  const list = Array.isArray(posts) ? posts : posts?.posts || posts?.recent_posts || posts?.results || [];
  const rows = list.map((item) => ({
    id: item.id || '',
    code: item.code || '',
    username: item.user?.username || '',
    user_id: item.user?.id || '',
    is_verified: item.user?.is_verified ? 'true' : 'false',
    caption: item.caption || '',
    likes: item.metrics?.likes ?? item.like_count ?? 0,
    replies: item.metrics?.replies ?? item.reply_count ?? 0,
    reposts: item.metrics?.reposts ?? item.repost_count ?? 0,
    quotes: item.metrics?.quotes ?? item.quote_count ?? 0,
    taken_at: item.taken_at || '',
    url: item.url || '',
    has_media: item.has_media ? 'true' : 'false',
    media_count: item.media?.length || 0,
  }));
  return toCsv(rows, [
    'id',
    'code',
    'username',
    'user_id',
    'is_verified',
    'caption',
    'likes',
    'replies',
    'reposts',
    'quotes',
    'taken_at',
    'url',
    'has_media',
    'media_count',
  ]);
}

export function formatRepliesCsv(data) {
  const list = Array.isArray(data) ? data : data?.replies || [];
  const rows = list.map((r) => ({
    id: r.id || '',
    post_id: r.post_id || '',
    parent_id: r.parent_id || '',
    code: r.code || '',
    username: r.username || '',
    user_id: r.user_id || '',
    is_verified: r.is_verified ? 'true' : 'false',
    text: r.text || '',
    likes: r.like_count || 0,
    taken_at: r.taken_at || '',
    url: r.url || '',
  }));
  return toCsv(rows, [
    'id',
    'post_id',
    'parent_id',
    'code',
    'username',
    'user_id',
    'is_verified',
    'text',
    'likes',
    'taken_at',
    'url',
  ]);
}

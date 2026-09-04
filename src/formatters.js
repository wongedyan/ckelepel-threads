/**
 * CLI terminal stdout human-friendly formatters
 */

export function formatProfileStdout(data) {
  const p = data.profile || data;
  const lines = [
    `=== Threads Profile: @${p.username} ===`,
    `ID:          ${p.id}`,
    `Full Name:   ${p.full_name || '-'}${p.is_verified ? ' [Verified]' : ''}`,
    `Followers:   ${(p.metrics?.followers_count ?? p.follower_count ?? 0).toLocaleString()}`,
    `Following:   ${(p.metrics?.following_count ?? p.following_count ?? 0).toLocaleString()}`,
    `Posts Count: ${(p.metrics?.posts_count ?? 0).toLocaleString()}`,
    `Private:     ${p.is_private ? 'Yes' : 'No'}`,
    `URL:         ${p.url || `https://www.threads.com/@${p.username}`}`,
  ];

  if (p.external_url) {
    lines.push(`Link:        ${p.external_url}`);
  }

  if (p.biography) {
    lines.push('--- Bio ---');
    lines.push(p.biography);
  }

  if (Array.isArray(data.recent_posts) && data.recent_posts.length > 0) {
    lines.push(`\n--- Recent Posts (${data.recent_posts.length}) ---`);
    for (const post of data.recent_posts) {
      lines.push(
        `[${post.code}] ${post.taken_at ? new Date(post.taken_at * 1000).toISOString().slice(0, 10) : ''} | Likes: ${post.metrics?.likes ?? post.like_count ?? 0} | Replies: ${post.metrics?.replies ?? post.reply_count ?? 0}`
      );
      if (post.caption) {
        const snippet = post.caption.replace(/\n+/g, ' ').slice(0, 100);
        lines.push(`  "${snippet}${post.caption.length > 100 ? '...' : ''}"`);
      }
    }
  }

  return lines.join('\n');
}

export function formatPostsStdout(data) {
  const list = Array.isArray(data) ? data : data?.posts || data?.results || [];
  const title = data.username ? `Posts for @${data.username}` : data.query ? `Search Results for "${data.query}"` : 'Threads Posts';
  const lines = [`=== ${title} (${list.length}) ===\n`];

  if (list.length === 0) {
    lines.push('No posts found.');
    return lines.join('\n');
  }

  list.forEach((post, i) => {
    lines.push(
      `${i + 1}. [${post.code || post.id}] @${post.user?.username || 'unknown'} ${post.user?.is_verified ? '[✓]' : ''}`
    );
    lines.push(
      `   Date: ${post.taken_at ? new Date(post.taken_at * 1000).toISOString() : '-'} | Likes: ${post.metrics?.likes ?? post.like_count ?? 0} | Replies: ${post.metrics?.replies ?? post.reply_count ?? 0} | Reposts: ${post.metrics?.reposts ?? post.repost_count ?? 0}`
    );
    if (post.caption) {
      const formatted = post.caption
        .split('\n')
        .map((l) => `   ${l}`)
        .join('\n');
      lines.push(formatted);
    }
    lines.push(`   Link: ${post.url || `https://www.threads.com/t/${post.code}`}\n`);
  });

  return lines.join('\n');
}

export function formatRepliesStdout(data) {
  const lines = [];
  if (data.rootPost) {
    lines.push(`=== Root Post: @${data.rootPost.user?.username || 'unknown'} [${data.rootPost.code || data.rootPost.id}] ===`);
    if (data.rootPost.caption) {
      lines.push(data.rootPost.caption);
    }
    lines.push(`Link: ${data.rootPost.url || `https://www.threads.com/t/${data.rootPost.code}`}`);
    lines.push('');
  }

  if (data.tree_ascii) {
    lines.push('=== Reply Tree ===');
    lines.push(data.tree_ascii);
  } else if (Array.isArray(data.replies)) {
    lines.push(`=== Replies (${data.replies.length}) ===\n`);
    data.replies.forEach((r, i) => {
      lines.push(`${i + 1}. @${r.username} (Likes: ${r.like_count || 0}):`);
      lines.push(`   ${r.text}`);
    });
  }

  return lines.join('\n');
}

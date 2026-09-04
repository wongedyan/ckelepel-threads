export function matchesStrictQuery(text, query) {
  if (!text || typeof text !== 'string' || !query || typeof query !== 'string') {
    return false;
  }
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return false;

  const cleanText = text.toLowerCase();

  // 1. Exact full phrase match
  const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRegex = new RegExp(`(?:^|[^a-z0-9_])#?${escaped}(?:$|[^a-z0-9_])`, 'i');
  if (boundaryRegex.test(cleanText)) return true;

  // 2. Token-level matching for multi-word queries: ALL significant tokens must be present
  const tokens = cleanQ.split(/\s+/).filter(t => t.length >= 3);
  if (tokens.length > 1) {
    const hasAllTokens = tokens.every(tok => {
      const tokEscaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokRegex = new RegExp(`(?:^|[^a-z0-9_])#?${tokEscaped}(?:$|[^a-z0-9_])`, 'i');
      return tokRegex.test(cleanText);
    });
    if (hasAllTokens) return true;
  }

  return false;
}

export function parseImage(imgObj) {
  if (!imgObj) return null;
  const candidates = imgObj.candidates || imgObj.image_versions2?.candidates || [];
  if (candidates.length === 0) return null;
  const best = candidates[0];
  return {
    type: 'image',
    url: best.url,
    width: best.width || null,
    height: best.height || null,
  };
}

export function parseVideo(vidObj, fallbackImg) {
  if (!vidObj) return null;
  const versions = vidObj.video_versions || [];
  if (versions.length === 0) return null;
  const bestVid = versions[0];
  const thumb = parseImage(fallbackImg || vidObj.image_versions2);
  return {
    type: 'video',
    url: bestVid.url,
    width: bestVid.width || null,
    height: bestVid.height || null,
    thumbnail_url: thumb?.url || null,
    duration_seconds: vidObj.video_duration || null,
    has_audio: vidObj.has_audio !== undefined ? !!vidObj.has_audio : true,
  };
}

export function extractMediaFromPost(post) {
  const mediaList = [];

  if (Array.isArray(post.carousel_media) && post.carousel_media.length > 0) {
    for (const item of post.carousel_media) {
      if (item.video_versions && item.video_versions.length > 0) {
        const v = parseVideo(item);
        if (v) mediaList.push(v);
      } else if (item.image_versions2) {
        const img = parseImage(item.image_versions2);
        if (img) mediaList.push(img);
      }
    }
  } else {
    if (post.video_versions && post.video_versions.length > 0) {
      const v = parseVideo(post, post.image_versions2);
      if (v) mediaList.push(v);
    } else if (post.image_versions2) {
      const img = parseImage(post.image_versions2);
      if (img) mediaList.push(img);
    }
  }

  return mediaList;
}

export function extractLinkPreview(post) {
  const linkAttachment =
    post.text_post_app_info?.link_preview_attachment ||
    post.link_preview_attachment ||
    post.share_info?.link_preview;

  if (!linkAttachment) return null;

  return {
    url: linkAttachment.url || linkAttachment.link_url || '',
    display_url: linkAttachment.display_url || '',
    title: linkAttachment.title || linkAttachment.header || '',
    description: linkAttachment.body || linkAttachment.description || '',
    image_url:
      linkAttachment.image_url || linkAttachment.image_versions2?.candidates?.[0]?.url || null,
  };
}

export function normalizePost(post) {
  if (!post || (!post.pk && !post.id)) return null;
  const tagHeader = post.text_post_app_info?.tag_header;
  const topic = tagHeader?.display_name || tagHeader?.tag_cluster_name || null;

  const media = extractMediaFromPost(post);
  const link_preview = extractLinkPreview(post);

  let quoted_post = null;
  const shareInfo = post.text_post_app_info?.share_info;
  const quotedRaw = shareInfo?.quoted_post || post.quoted_post;
  if (quotedRaw && (quotedRaw.pk || quotedRaw.id)) {
    quoted_post = {
      id: String(quotedRaw.pk || quotedRaw.id),
      code: quotedRaw.code || '',
      caption: quotedRaw.caption?.text || quotedRaw.text || '',
      username: quotedRaw.user?.username || '',
      url: quotedRaw.code
        ? `https://www.threads.com/@${quotedRaw.user?.username}/post/${quotedRaw.code}`
        : '',
      media: extractMediaFromPost(quotedRaw),
    };
  }

  const likeCount = post.like_count || 0;
  const replyCount = post.reply_count || post.text_post_app_info?.direct_reply_count || 0;
  const repostCount = post.text_post_app_info?.repost_count || 0;
  const quoteCount = post.text_post_app_info?.quote_count || 0;

  return {
    id: String(post.pk || post.id || ''),
    code: post.code || '',
    caption: post.caption?.text || post.text || '',
    topic,
    user: {
      username: post.user?.username || '',
      full_name: post.user?.full_name || '',
      pk: String(post.user?.pk || post.user?.id || ''),
      profile_pic_url: post.user?.profile_pic_url || '',
      is_verified: !!post.user?.is_verified,
    },
    author: {
      id: String(post.user?.pk || post.user?.id || ''),
      username: post.user?.username || '',
      full_name: post.user?.full_name || '',
      profile_pic_url: post.user?.profile_pic_url || '',
      is_verified: !!post.user?.is_verified,
    },
    metrics: {
      likes: likeCount,
      replies: replyCount,
      reposts: repostCount,
      quotes: quoteCount,
    },
    media,
    has_media: media.length > 0,
    link_preview,
    is_quote: !!quoted_post,
    quoted_post,
    is_reply: !!post.text_post_app_info?.reply_to_author,
    reply_to_username: post.text_post_app_info?.reply_to_author?.username || null,
    like_count: likeCount,
    reply_count: replyCount,
    repost_count: repostCount,
    quote_count: quoteCount,
    taken_at: post.taken_at || Math.floor(Date.now() / 1000),
    url: post.code ? `https://www.threads.com/@${post.user?.username}/post/${post.code}` : '',
  };
}

export function extractInitialPayload(html) {
  const items = [];
  let endCursor = null;
  let hasNextPage = false;

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (
      raw.includes('RelayPrefetchedStreamCache') ||
      raw.includes('searchResults') ||
      raw.includes('xdt_api') ||
      raw.includes('ScheduledServerJS')
    ) {
      try {
        const parsed = JSON.parse(raw);
        function findPayload(obj) {
          if (!obj || typeof obj !== 'object') return;
          if (obj.searchResults || obj.xdt_api__v1__text_feed__search_results__connection_v2) {
            const data =
              obj.searchResults || obj.xdt_api__v1__text_feed__search_results__connection_v2;
            if (data.page_info?.end_cursor) endCursor = data.page_info.end_cursor;
            if (data.page_info?.has_next_page !== undefined)
              hasNextPage = data.page_info.has_next_page;
            if (Array.isArray(data.edges)) {
              for (const edge of data.edges) {
                const post =
                  edge.node?.thread?.thread_items?.[0]?.post ||
                  edge.node?.thread_items?.[0]?.post ||
                  edge.post;
                if (post && (post.pk || post.id)) {
                  const formatted = normalizePost(post);
                  if (formatted) items.push(formatted);
                }
              }
            }
          }
          if (Array.isArray(obj)) {
            for (const el of obj) findPayload(el);
          } else {
            for (const k of Object.keys(obj)) findPayload(obj[k]);
          }
        }
        findPayload(parsed);
      } catch {}
    }
  }

  return { items, endCursor, hasNextPage };
}

export function extractPostsFromHtml(html) {
  const payload = extractInitialPayload(html);
  return payload.items || [];
}

export function buildReplyTree(rootPost, replies = []) {
  if (!rootPost) return null;

  const rootId = String(rootPost.id || rootPost.pk || '');
  const rootNode = {
    ...rootPost,
    id: rootId,
    parent_id: null,
    depth: 0,
    replies: [],
  };

  const nodeMap = new Map();
  nodeMap.set(rootId, rootNode);

  const cleanReplies = Array.isArray(replies) ? replies : [];
  for (const r of cleanReplies) {
    const rId = String(r.id || r.pk || '');
    if (rId) {
      nodeMap.set(rId, {
        ...r,
        id: rId,
        parent_id: r.parent_id ? String(r.parent_id) : rootId,
        depth: 1,
        replies: [],
      });
    }
  }

  for (const r of cleanReplies) {
    const rId = String(r.id || r.pk || '');
    const node = nodeMap.get(rId);
    if (!node) continue;

    const parent = nodeMap.get(node.parent_id);
    if (parent && parent !== node) {
      node.depth = (parent.depth || 0) + 1;
      parent.replies.push(node);
    } else if (node !== rootNode) {
      node.depth = 1;
      rootNode.replies.push(node);
    }
  }

  return rootNode;
}

export function formatReplyTreeAscii(rootNode) {
  if (!rootNode) return '';

  function renderNode(node, prefix = '', isLast = true, isRoot = true) {
    let output = '';
    const textSnippet = (node.text || node.caption?.text || node.caption || '')
      .replace(/\n+/g, ' ')
      .slice(0, 70);
    const likes = node.like_count || node.metrics?.likes || 0;
    const author = node.username || node.user?.username || 'unknown';

    if (isRoot) {
      output += `[ROOT] @${author}: "${textSnippet}" (Likes: ${likes})\n`;
    } else {
      const marker = isLast ? '└── ' : '├── ';
      output += `${prefix}${marker}@${author}: "${textSnippet}" (Likes: ${likes})\n`;
    }

    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
    const childList = node.replies || [];
    childList.forEach((child, idx) => {
      const lastChild = idx === childList.length - 1;
      output += renderNode(child, childPrefix, lastChild, false);
    });

    return output;
  }

  return renderNode(rootNode).trimEnd();
}

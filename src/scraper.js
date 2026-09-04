import {
  SEARCH_DOC_ID,
  PROFILE_POSTS_DOC_ID,
  REPLIES_DOC_ID,
  THREADS_GRAPHQL_ENDPOINT,
  fetchWithRetry,
  sleep,
  jitterDelay,
} from './http.js';
import {
  matchesStrictQuery,
  extractInitialPayload,
  extractPostsFromHtml,
  normalizePost,
  buildReplyTree,
  formatReplyTreeAscii,
} from './normalizers.js';

export async function getProfile(username, options = {}) {
  const cleanUsername = username.replace(/^@/, '').trim();
  if (!cleanUsername) {
    throw new Error('Username profil Threads wajib diisi');
  }

  const profileUrl = `https://www.threads.com/@${encodeURIComponent(cleanUsername)}`;
  const res = await fetchWithRetry(
    profileUrl,
    {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      proxy: options.proxy,
      cookie: options.cookie,
    },
    { fetchFn: options.fetchFn }
  );

  if (!res.ok) {
    throw new Error(`Threads profile fetch failed: HTTP ${res.status} ${res.statusText || ''}`);
  }

  const html = await res.text();
  let userObj = null;
  const recentPosts = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  function findUser(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (
      obj.user &&
      obj.user.username &&
      (obj.user.follower_count !== undefined ||
        obj.user.biography !== undefined ||
        obj.user.text_app_biography !== undefined)
    ) {
      return obj.user;
    }
    if (
      obj.username &&
      (obj.follower_count !== undefined ||
        obj.biography !== undefined ||
        obj.text_app_biography !== undefined)
    ) {
      return obj;
    }
    for (const k of Object.keys(obj)) {
      const found = findUser(obj[k]);
      if (found) return found;
    }
    return null;
  }

  function findRecentPosts(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.thread_items && Array.isArray(obj.thread_items)) {
      for (const ti of obj.thread_items) {
        if (ti.post && (ti.post.pk || ti.post.id)) {
          const norm = normalizePost(ti.post);
          if (norm && !recentPosts.some((p) => p.id === norm.id)) {
            recentPosts.push(norm);
          }
        }
      }
    }
    if (Array.isArray(obj)) {
      obj.forEach(findRecentPosts);
    } else {
      Object.values(obj).forEach(findRecentPosts);
    }
  }

  while ((match = scriptRegex.exec(html)) !== null) {
    if (
      match[1].includes('follower_count') ||
      match[1].includes('biography') ||
      match[1].includes('user')
    ) {
      try {
        const parsed = JSON.parse(match[1]);
        if (!userObj) {
          userObj = findUser(parsed);
        }
        if (options.fetchPosts) {
          findRecentPosts(parsed);
        }
      } catch {}
    }
  }

  if (!userObj) {
    throw new Error(`Gagal menemukan data profil Threads untuk @${cleanUsername}`);
  }

  let bioText = '';
  if (typeof userObj.biography === 'string') {
    bioText = userObj.biography;
  } else if (typeof userObj.text_app_biography === 'string') {
    bioText = userObj.text_app_biography;
  } else if (userObj.text_app_biography?.text_fragments?.fragments) {
    bioText = userObj.text_app_biography.text_fragments.fragments
      .map((f) => f.plaintext || '')
      .join('');
  } else if (userObj.biography?.text) {
    bioText = userObj.biography.text;
  }

  const bioLinks = Array.isArray(userObj.bio_links)
    ? userObj.bio_links.map((bl) => ({
        title: bl.title || '',
        url: bl.url || '',
        lynx_url: bl.lynx_url || '',
      }))
    : [];

  const followerCount = userObj.follower_count || 0;
  const followingCount = userObj.following_count || 0;
  const postsCount = userObj.text_post_app_info?.post_count || 0;

  const profile = {
    id: String(userObj.pk || userObj.id || ''),
    username: userObj.username || cleanUsername,
    full_name: userObj.full_name || '',
    biography: bioText,
    bio_links: bioLinks,
    external_url: userObj.external_url || (bioLinks[0]?.url ?? null),
    profile_pic_url: userObj.profile_pic_url || '',
    profile_pic_url_hd:
      userObj.hd_profile_pic_versions?.[0]?.url ||
      userObj.hd_profile_pic_url_info?.url ||
      userObj.profile_pic_url ||
      '',
    is_verified: !!userObj.is_verified,
    is_private: !!userObj.is_private || !!userObj.text_post_app_is_private,
    is_joined_recently: !!userObj.is_joined_recently,
    metrics: {
      followers_count: followerCount,
      following_count: followingCount,
      posts_count: postsCount,
    },
    follower_count: followerCount,
    following_count: followingCount,
    url: `https://www.threads.com/@${userObj.username || cleanUsername}`,
  };

  const limit = options.limit || 10;
  const slicedPosts = recentPosts.slice(0, limit);

  return {
    status: 'ok',
    profile,
    recent_posts_count: slicedPosts.length,
    recent_posts: slicedPosts,
  };
}

export async function getUserPosts(username, options = {}) {
  const cleanUsername = username.replace(/^@/, '').trim();
  if (!cleanUsername) {
    throw new Error('Username profil Threads wajib diisi');
  }

  const limit = options.limit || 20;
  const allPosts = new Map();

  const profileUrl = `https://www.threads.com/@${encodeURIComponent(cleanUsername)}`;
  const initRes = await fetchWithRetry(
    profileUrl,
    {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      proxy: options.proxy,
      cookie: options.cookie,
    },
    { fetchFn: options.fetchFn }
  );

  if (!initRes.ok) {
    throw new Error(
      `Threads profile initial fetch failed: HTTP ${initRes.status} ${initRes.statusText || ''}`
    );
  }

  const html = await initRes.text();

  const lsd = (html.match(/\["LSD",\[\],\{"token":"([^"]+)"\}/) || [])[1] || 'AVp_test_lsd';
  const fb_dtsg = (html.match(/\["DTSGInitialData",\[\],\{"token":"([^"]+)"/) || [])[1] || '';
  const jazoest = (html.match(/jazoest=(\d+)/) || [])[1] || '26499';
  const spin_r = (html.match(/"__spin_r":(\d+)/) || [])[1] || '1046277330';
  const spin_t = String(Math.floor(Date.now() / 1000));

  let userId = null;
  let endCursor = null;
  let hasNextPage = false;

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    if (
      match[1].includes('mediaData') ||
      match[1].includes('follower_count') ||
      match[1].includes('BarcelonaProfileThreadsTab')
    ) {
      try {
        const parsed = JSON.parse(match[1]);

        function findMediaData(o) {
          if (!o || typeof o !== 'object') return;
          if (o.mediaData) {
            if (o.mediaData.page_info?.end_cursor) endCursor = o.mediaData.page_info.end_cursor;
            if (o.mediaData.page_info?.has_next_page !== undefined)
              hasNextPage = o.mediaData.page_info.has_next_page;

            if (Array.isArray(o.mediaData.edges)) {
              for (const edge of o.mediaData.edges) {
                const post =
                  edge.node?.thread_items?.[0]?.post ||
                  edge.node?.thread?.thread_items?.[0]?.post ||
                  edge.node?.post;
                if (post && (post.pk || post.id)) {
                  const norm = normalizePost(post);
                  if (norm && !allPosts.has(norm.id)) {
                    allPosts.set(norm.id, norm);
                    if (typeof options.onProgress === 'function') {
                      options.onProgress(allPosts.size, limit);
                    }
                  }
                }
              }
            }
          }
          if (o.user && o.user.pk) {
            userId = String(o.user.pk);
          }
          if (o.userID) {
            userId = String(o.userID);
          }
          if (Array.isArray(o)) o.forEach(findMediaData);
          else Object.values(o).forEach(findMediaData);
        }

        findMediaData(parsed);
      } catch {}
    }
  }

  let currentCursor = endCursor;
  let page = 1;
  const maxPages = Math.ceil((limit - allPosts.size) / 20) + 3;

  while (userId && currentCursor && hasNextPage && allPosts.size < limit && page <= maxPages) {
    page++;
    try {
      const variables = {
        after: currentCursor,
        before: null,
        first: 20,
        last: null,
        allow_page_info_for_lox_user: false,
        userID: userId,
        __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
        __relay_internal__pv__BarcelonaHasProfileSelfReplyContextrelayprovider: true,
        __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
        __relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
        __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: true,
        __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: true,
        __relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasMusicrelayprovider: true,
        __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
        __relay_internal__pv__BarcelonaHasMessagingrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasTappableElementsConsumptionrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider: true,
        __relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider: true,
        __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
        __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
        __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
        __relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider: false,
        __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
        __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: true,
        __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
      };

      const postParams = new URLSearchParams({
        av: '17841433354984910',
        __user: '0',
        __a: '1',
        __req: String(page),
        __hs: '20693.HYP:barcelona_web_pkg.2.1...0',
        dpr: '1',
        __ccg: 'GOOD',
        __rev: spin_r,
        __s: '98f905:2z7b95:e2vhd3',
        __hsi: '7679099332477842999',
        __comet_req: '29',
        fb_dtsg,
        jazoest,
        lsd,
        __spin_r: spin_r,
        __spin_b: 'trunk',
        __spin_t: spin_t,
        __crn: 'comet.threads.BarcelonaProfileThreadsColumnRoute',
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'BarcelonaProfileThreadsTabRefetchableQuery',
        server_timestamps: 'true',
        variables: JSON.stringify(variables),
        doc_id: PROFILE_POSTS_DOC_ID,
      });

      const gres = await fetchWithRetry(
        THREADS_GRAPHQL_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-FB-LSD': lsd,
            'X-FB-Friendly-Name': 'BarcelonaProfileThreadsTabRefetchableQuery',
            'X-IG-App-ID': '238260118697367',
            'X-Root-Field-Name': 'mediaData',
            Origin: 'https://www.threads.com',
            Referer: profileUrl,
          },
          body: postParams.toString(),
          proxy: options.proxy,
        cookie: options.cookie,
        },
        { fetchFn: options.fetchFn }
      );

      if (!gres.ok) break;

      const gdata = await gres.json();
      const mediaData = gdata?.data?.mediaData;
      const edges = mediaData?.edges || [];

      if (edges.length === 0) break;

      for (const edge of edges) {
        const post =
          edge.node?.thread_items?.[0]?.post ||
          edge.node?.thread?.thread_items?.[0]?.post ||
          edge.node?.post;
        if (post && (post.pk || post.id)) {
          const norm = normalizePost(post);
          if (norm && !allPosts.has(norm.id)) {
            allPosts.set(norm.id, norm);
            if (typeof options.onProgress === 'function') {
              options.onProgress(allPosts.size, limit);
            }
          }
        }
        if (allPosts.size >= limit) break;
      }

      currentCursor = mediaData?.page_info?.end_cursor;
      hasNextPage = !!mediaData?.page_info?.has_next_page;

      if (hasNextPage && currentCursor && allPosts.size < limit) {
        await sleep(jitterDelay(150, 350));
      }
    } catch {
      break;
    }
  }

  const results = Array.from(allPosts.values()).slice(0, limit);

  return {
    status: 'ok',
    username: cleanUsername,
    user_id: userId,
    count: results.length,
    posts: results,
  };
}

export async function searchThreads(query, options = {}) {
  // Support both single query string and array of multi-queries (e.g. fan-out search)
  const queries = Array.isArray(query)
    ? query.map((q) => String(q).trim()).filter(Boolean)
    : [String(query || '').trim()].filter(Boolean);

  if (queries.length === 0) {
    throw new Error('Search query is required');
  }

  const limit = options.limit || 20;
  const isStrict = options.strict !== false;
  const allPosts = new Map();

  // If multiple queries provided, run multi-query fan-out across queries & facets
  const facetUrls = [];
  for (const q of queries) {
    facetUrls.push(`https://www.threads.net/search?q=${encodeURIComponent(q)}&serp_type=default`);
    facetUrls.push(`https://www.threads.net/search?q=${encodeURIComponent(q)}&serp_type=default&filter=recent`);
  }

  const fetchPromises = facetUrls.map((url) =>
    fetchWithRetry(
      url,
      {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        proxy: options.proxy,
        cookie: options.cookie,
      },
      { fetchFn: options.fetchFn }
    )
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
  );

  const htmlResults = await Promise.all(fetchPromises);

  const collected = [];
  for (const html of htmlResults) {
    if (!html) continue;
    const items = extractPostsFromHtml(html);
    for (const item of items) {
      if (!allPosts.has(item.id)) {
        allPosts.set(item.id, item);
        collected.push(item);
        if (typeof options.onProgress === 'function') {
          options.onProgress(collected.length, limit);
        }
      }
    }
  }

  const clean = queries[0];

  // Sequential GraphQL cursor pagination if single query and limit not reached
  if (collected.length < limit) {
    try {
      const initUrl = facetUrls[0];
      const initHtml = htmlResults[0] || '';
      const lsd = (initHtml.match(/\["LSD",\[\],\{"token":"([^"]+)"\}/) || [])[1] || 'AVp_test_lsd';
      const fb_dtsg = (initHtml.match(/\["DTSGInitialData",\[\],\{"token":"([^"]+)"/) || [])[1] || '';
      const jazoest = (initHtml.match(/jazoest=(\d+)/) || [])[1] || '26499';
      const spin_r = (initHtml.match(/"__spin_r":(\d+)/) || [])[1] || '1046277330';
      const spin_t = String(Math.floor(Date.now() / 1000));

      let { endCursor, hasNextPage } = extractInitialPayload(initHtml);
      let currentCursor = endCursor;
      let page = 1;
      const maxPages = Math.ceil((limit - allPosts.size) / 20) + 3;

      while (currentCursor && hasNextPage && allPosts.size < limit && page <= maxPages) {
        page++;
        const variables = {
          after: currentCursor,
          before: null,
          first: 20,
          has_communities: true,
          has_community_green_dot: false,
          has_favicons: false,
          has_live_chats: false,
          has_serp_header: false,
          last: null,
          meta_place_id: null,
          pinned_ids: null,
          power_search_info: null,
          query: clean,
          recent: 0,
          search_surface: 'default',
          tagID: null,
          trend_fbid: null,
          __relay_internal__pv__BarcelonaHasSERPHeaderrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunitiesOrLoggedOutrelayprovider: true,
          __relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunityGreenDotrelayprovider: false,
          __relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunityBobbleheadsrelayprovider: true,
          __relay_internal__pv__BarcelonaHasCommunityTrendingBadgingrelayprovider: false,
          __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
          __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
          __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
          __relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider: false,
          __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
          __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: true,
          __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: true,
          __relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider: false,
          __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: true,
          __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: true,
          __relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider: true,
          __relay_internal__pv__BarcelonaHasMusicrelayprovider: true,
          __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
          __relay_internal__pv__BarcelonaHasMessagingrelayprovider: true,
          __relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider: true,
          __relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider: true,
          __relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider: true,
          __relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider: true,
          __relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider: true,
          __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
          __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
          __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
          __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
          __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
          __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: true,
          __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
        };

        const postParams = new URLSearchParams({
          av: '17841433354984910',
          __user: '0',
          __a: '1',
          __req: String(page),
          __hs: '20693.HYP:barcelona_web_pkg.2.1...0',
          dpr: '1',
          __ccg: 'GOOD',
          __rev: spin_r,
          __s: '98f905:2z7b95:e2vhd3',
          __hsi: '7679099332477842999',
          __comet_req: '29',
          fb_dtsg,
          jazoest,
          lsd,
          __spin_r: spin_r,
          __spin_b: 'trunk',
          __spin_t: spin_t,
          __crn: 'comet.threads.BarcelonaSearchResultsColumnRoute',
          fb_api_caller_class: 'RelayModern',
          fb_api_req_friendly_name: 'BarcelonaSearchResultsRefetchableQuery',
          server_timestamps: 'true',
          variables: JSON.stringify(variables),
          doc_id: SEARCH_DOC_ID,
        });

        const gres = await fetchWithRetry(
          THREADS_GRAPHQL_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-FB-LSD': lsd,
              'X-FB-Friendly-Name': 'BarcelonaSearchResultsRefetchableQuery',
              'X-IG-App-ID': '238260118697367',
              'X-Root-Field-Name': 'xdt_api__v1__text_feed__search_results__connection_v2',
              Origin: 'https://www.threads.com',
              Referer: initUrl,
            },
            body: postParams.toString(),
            proxy: options.proxy,
        cookie: options.cookie,
          },
          { fetchFn: options.fetchFn }
        );

        if (!gres.ok) break;

        const gdata = await gres.json();
        const searchData =
          gdata?.data?.xdt_api__v1__text_feed__search_results__connection_v2 ||
          gdata?.data?.searchResults;
        const edges = searchData?.edges || [];

        if (edges.length === 0) break;

        for (const edge of edges) {
          const post =
            edge.node?.thread?.thread_items?.[0]?.post || edge.node?.thread_items?.[0]?.post;
          if (post && (post.pk || post.id)) {
            const formatted = normalizePost(post);
            if (formatted && !allPosts.has(formatted.id)) {
              allPosts.set(formatted.id, formatted);
              collected.push(formatted);
              if (typeof options.onProgress === 'function') {
                options.onProgress(collected.length, limit);
              }
            }
          }
          if (collected.length >= limit) break;
        }

        currentCursor = searchData?.page_info?.end_cursor;
        hasNextPage = !!searchData?.page_info?.has_next_page;

        if (hasNextPage && currentCursor && collected.length < limit) {
          await sleep(jitterDelay(150, 350));
        }
      }
    } catch (_) {}
  }

  // Filter & Sort
  collected.sort((a, b) => {
    const aMatch = matchesStrictQuery(a.caption, clean) ? 1 : 0;
    const bMatch = matchesStrictQuery(b.caption, clean) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return (b.like_count + b.reply_count) - (a.like_count + a.reply_count);
  });

  const finalFiltered = isStrict
    ? collected.filter((item) => matchesStrictQuery(item.caption, clean))
    : collected;

  const results = (finalFiltered.length > 0 ? finalFiltered : collected).slice(0, limit);

  return {
    status: 'ok',
    query: clean,
    count: results.length,
    results,
    mode: 'direct-http-serp-graphql',
  };
}

export async function getPostReplies(target, options = {}) {
  const limit = options.limit || 20;

  let code = target.trim();
  const urlMatch = code.match(/post\/([A-Za-z0-9_-]+)/) || code.match(/\/t\/([A-Za-z0-9_-]+)/);
  if (urlMatch) {
    code = urlMatch[1];
  }

  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error(`Invalid Threads post shortcode or URL format: ${target}`);
  }

  const postUrl = `https://www.threads.com/t/${encodeURIComponent(code)}`;
  const res = await fetchWithRetry(
    postUrl,
    {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      proxy: options.proxy,
      cookie: options.cookie,
    },
    { fetchFn: options.fetchFn }
  );

  if (!res.ok) {
    throw new Error(`Threads post fetch failed: HTTP ${res.status} ${res.statusText || ''}`);
  }

  const html = await res.text();
  let rootPost = null;
  const replies = [];
  const seenIds = new Set();
  let currentCursor = null;
  let hasNextPage = false;
  let targetPostId = null;

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  function processEdge(edge) {
    const items = edge.node?.thread_items || [];
    if (items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const post = item.post;
      if (post && (post.pk || post.id)) {
        const pkStr = String(post.pk || post.id);
        if (!rootPost) {
          rootPost = normalizePost(post);
          targetPostId = rootPost.id;
        } else if (pkStr !== String(rootPost.id)) {
          if (!seenIds.has(pkStr)) {
            seenIds.add(pkStr);
            let parentId = String(rootPost.id);
            if (i > 0 && (items[i - 1]?.post?.pk || items[i - 1]?.post?.id)) {
              parentId = String(items[i - 1].post.pk || items[i - 1].post.id);
            }

            const normalizedReply = {
              id: pkStr,
              post_id: rootPost.id,
              parent_id: parentId,
              code: post.code || '',
              username: post.user?.username || '',
              user_id: post.user?.pk || '',
              text: post.caption?.text || post.text || '',
              reply_to: post.text_post_app_info?.reply_to_author?.username || null,
              like_count: post.like_count || 0,
              reply_count: post.text_post_app_info?.direct_reply_count || 0,
              created_at: post.taken_at || Math.floor(Date.now() / 1000),
              url: post.code
                ? `https://www.threads.com/@${post.user?.username}/post/${post.code}`
                : '',
            };
            replies.push(normalizedReply);
            if (typeof options.onProgress === 'function') {
              options.onProgress(replies.length, limit);
            }
          }
        }
      }
    }
  }

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1];
    if (
      raw.includes('BarcelonaPostPageDirectQueryRelayPreloader') ||
      raw.includes('RelayPrefetchedStreamCache')
    ) {
      try {
        const cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const parsed = JSON.parse(cleaned);
        function findEdgesInBbox(obj) {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.data && obj.data.edges) return obj.data;
          if (obj.edges && Array.isArray(obj.edges)) return obj;
          for (const k of Object.keys(obj)) {
            const found = findEdgesInBbox(obj[k]);
            if (found) return found;
          }
          return null;
        }
        const dataObj = findEdgesInBbox(parsed);
        if (dataObj && Array.isArray(dataObj.edges)) {
          for (const edge of dataObj.edges) {
            processEdge(edge);
          }
          if (dataObj.page_info) {
            currentCursor = dataObj.page_info.end_cursor || null;
            hasNextPage = !!dataObj.page_info.has_next_page;
          }
        }
      } catch {}
    }
  }

  if (replies.length === 0 || !rootPost) {
    const fallbackRegex = /<script type="application\/json" [^>]*data-sjs>([\s\S]*?)<\/script>/g;
    let fbMatch;
    function findEdges(obj) {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.data && obj.data.edges) return obj.data;
      for (const k of Object.keys(obj)) {
        const found = findEdges(obj[k]);
        if (found) return found;
      }
      return null;
    }
    while ((fbMatch = fallbackRegex.exec(html)) !== null) {
      if (fbMatch[1].includes('BarcelonaPostPageDirectQueryRelayPreloader')) {
        try {
          const parsed = JSON.parse(fbMatch[1]);
          const dataObj = findEdges(parsed);
          if (dataObj && dataObj.edges) {
            for (const edge of dataObj.edges) {
              processEdge(edge);
            }
            if (dataObj.page_info) {
              currentCursor = dataObj.page_info.end_cursor || currentCursor;
              hasNextPage =
                dataObj.page_info.has_next_page !== undefined
                  ? !!dataObj.page_info.has_next_page
                  : hasNextPage;
            }
          }
        } catch {}
      }
    }
  }

  // GraphQL cursor pagination loop
  while (replies.length < limit && hasNextPage && currentCursor && targetPostId) {
    try {
      const variables = {
        postID: targetPostId,
        sort_order: 'TOP',
        after: currentCursor,
        __relay_internal__pv__BarcelonaHasPermalinkIndentationrelayprovider: false,
        __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
        __relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPodcastV2Productionrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityPermalinkPivotsrelayprovider: false,
        __relay_internal__pv__BarcelonaHasInsightsPermalinkUFIrelayprovider: false,
        __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
        __relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
        __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: true,
        __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: true,
        __relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasMusicrelayprovider: true,
        __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
        __relay_internal__pv__BarcelonaHasMessagingrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasTappableElementsConsumptionrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider: true,
        __relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider: true,
        __relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider: true,
        __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
        __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
        __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
        __relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider: false,
        __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
        __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: true,
        __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
        __relay_internal__pv__BarcelonaHasPostAuthorNotifControlsrelayprovider: true,
        __relay_internal__pv__BarcelonaHasInsightsPermalinkCTArelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityNoteWriteEntrypointrelayprovider: false,
      };

      const params = new URLSearchParams();
      params.append('lsd', 'AVr_8k8q6l8');
      params.append('doc_id', REPLIES_DOC_ID);
      params.append('variables', JSON.stringify(variables));

      const gres = await fetchWithRetry(
        THREADS_GRAPHQL_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-FB-Friendly-Name': 'BarcelonaPostPageDirectQuery',
          },
          body: params.toString(),
          proxy: options.proxy,
        cookie: options.cookie,
        },
        { fetchFn: options.fetchFn }
      );

      if (!gres.ok) break;

      const gjson = await gres.json();
      const pageData = gjson?.data?.data;
      if (!pageData || !Array.isArray(pageData.edges) || pageData.edges.length === 0) {
        break;
      }

      const prevCount = replies.length;
      for (const edge of pageData.edges) {
        processEdge(edge);
      }

      currentCursor = pageData.page_info?.end_cursor || null;
      hasNextPage = !!pageData.page_info?.has_next_page;

      if (replies.length === prevCount || !currentCursor) {
        break;
      }

      if (hasNextPage && currentCursor && replies.length < limit) {
        await sleep(jitterDelay(150, 350));
      }
    } catch {
      break;
    }
  }

  const results = replies.slice(0, limit);
  const responseData = {
    status: 'ok',
    rootPost,
    count: results.length,
    replies: results,
  };

  if (options.tree) {
    const tree = buildReplyTree(rootPost, results);
    responseData.tree = tree;
    responseData.tree_ascii = formatReplyTreeAscii(tree);
  }

  return responseData;
}

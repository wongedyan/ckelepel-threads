import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION,
  getProfile,
  getUserPosts,
  searchThreads,
  getPostReplies,
  buildReplyTree,
  formatReplyTreeAscii,
  normalizePost,
  matchesStrictQuery,
} from '../src/index.js';

describe('ckelepel-threads pure engine tests', () => {
  it('exports semantic version and methods', () => {
    assert.equal(VERSION, '1.0.0');
    assert.equal(typeof getProfile, 'function');
    assert.equal(typeof getUserPosts, 'function');
    assert.equal(typeof searchThreads, 'function');
    assert.equal(typeof getPostReplies, 'function');
  });

  it('matchesStrictQuery matches keyword and tokens accurately', () => {
    assert.equal(matchesStrictQuery('Learning artificial intelligence today', 'artificial intelligence'), true);
    assert.equal(matchesStrictQuery('Just drinking coffee', 'artificial intelligence'), false);
    assert.equal(matchesStrictQuery('Hashtag #golang is awesome', 'golang'), true);
    assert.equal(matchesStrictQuery('', 'test'), false);
  });

  it('normalizePost formats post object safely', () => {
    const rawPost = {
      pk: '123456789',
      code: 'CxY123z',
      caption: { text: 'Hello Threads world' },
      like_count: 42,
      reply_count: 5,
      user: {
        username: 'coder_dev',
        full_name: 'Coder Dev',
        pk: '987654',
        profile_pic_url: 'https://example.com/avatar.jpg',
        is_verified: true,
      },
      image_versions2: {
        candidates: [{ url: 'https://example.com/img.jpg', width: 1080, height: 1080 }],
      },
    };

    const normalized = normalizePost(rawPost);
    assert.equal(normalized.id, '123456789');
    assert.equal(normalized.code, 'CxY123z');
    assert.equal(normalized.caption, 'Hello Threads world');
    assert.equal(normalized.user.username, 'coder_dev');
    assert.equal(normalized.metrics.likes, 42);
    assert.equal(normalized.has_media, true);
    assert.equal(normalized.media[0].type, 'image');
    assert.equal(normalized.media[0].url, 'https://example.com/img.jpg');
  });

  it('buildReplyTree and formatReplyTreeAscii generates proper structure', () => {
    const root = {
      id: 'root_1',
      caption: 'Main topic discussion',
      user: { username: 'alice' },
      like_count: 10,
    };

    const replies = [
      {
        id: 'reply_1',
        parent_id: 'root_1',
        text: 'First reply',
        username: 'bob',
        like_count: 3,
      },
      {
        id: 'reply_2',
        parent_id: 'reply_1',
        text: 'Nested reply to bob',
        username: 'charlie',
        like_count: 1,
      },
    ];

    const tree = buildReplyTree(root, replies);
    assert.equal(tree.id, 'root_1');
    assert.equal(tree.replies.length, 1);
    assert.equal(tree.replies[0].id, 'reply_1');
    assert.equal(tree.replies[0].replies.length, 1);
    assert.equal(tree.replies[0].replies[0].id, 'reply_2');

    const ascii = formatReplyTreeAscii(tree);
    assert.ok(ascii.includes('[ROOT] @alice'));
    assert.ok(ascii.includes('@bob'));
    assert.ok(ascii.includes('@charlie'));
  });

  it('getProfile parses profile and posts from mock response', async () => {
    const mockHtml = `
      <html>
        <head>
          <script type="application/json">
            {
              "user": {
                "pk": "11223344",
                "username": "zuck",
                "full_name": "Mark Zuckerberg",
                "follower_count": 5000000,
                "following_count": 120,
                "biography": "Building open source AI",
                "is_verified": true,
                "profile_pic_url": "https://example.com/zuck.jpg"
              }
            }
          </script>
        </head>
      </html>
    `;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    });

    const res = await getProfile('zuck', { fetchFn: mockFetch });
    assert.equal(res.status, 'ok');
    assert.equal(res.profile.username, 'zuck');
    assert.equal(res.profile.follower_count, 5000000);
    assert.equal(res.profile.biography, 'Building open source AI');
  });

  it('getUserPosts parses user posts from mock response', async () => {
    const mockHtml = `
      <html>
        <head>
          <script type="application/json">
            {
              "mediaData": {
                "edges": [
                  {
                    "node": {
                      "thread_items": [
                        {
                          "post": {
                            "pk": "post_100",
                            "code": "CxPost1",
                            "caption": { "text": "Post test caption" },
                            "like_count": 15,
                            "user": { "username": "zuck", "pk": "11223344" }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          </script>
        </head>
      </html>
    `;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    });

    const res = await getUserPosts('zuck', { fetchFn: mockFetch });
    assert.equal(res.status, 'ok');
    assert.equal(res.count, 1);
    assert.equal(res.posts[0].id, 'post_100');
    assert.equal(res.posts[0].caption, 'Post test caption');
  });

  it('searchThreads extracts posts from SERP HTML', async () => {
    const mockHtml = `
      <html>
        <head>
          <script type="application/json">
            {
              "searchResults": {
                "edges": [
                  {
                    "node": {
                      "thread_items": [
                        {
                          "post": {
                            "pk": "search_p1",
                            "code": "SrchCode1",
                            "caption": { "text": "Talking about artificial intelligence" },
                            "like_count": 99,
                            "user": { "username": "ai_fan" }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          </script>
        </head>
      </html>
    `;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    });

    const res = await searchThreads('artificial intelligence', { fetchFn: mockFetch });
    assert.equal(res.status, 'ok');
    assert.equal(res.count, 1);
    assert.equal(res.results[0].id, 'search_p1');
    assert.equal(res.results[0].caption, 'Talking about artificial intelligence');
  });

  it('getPostReplies extracts comments and builds reply tree', async () => {
    const mockHtml = `
      <html>
        <body>
          <script>
            /* BarcelonaPostPageDirectQueryRelayPreloader RelayPrefetchedStreamCache */
            {
              "require": [
                [
                  "RelayPrefetchedStreamCache",
                  "set",
                  [],
                  [
                    {
                      "__bbox": {
                        "require": [
                          [
                            "RelayPrefetchedStreamCache",
                            "next",
                            [],
                            [
                              {
                                "__bbox": {
                                  "result": {
                                    "data": {
                                      "data": {
                                        "edges": [
                                          {
                                            "node": {
                                              "thread_items": [
                                                {
                                                  "post": {
                                                    "pk": "root_999",
                                                    "code": "DFu1_MVz6SE",
                                                    "caption": { "text": "Root thread content" },
                                                    "user": { "username": "zuck", "pk": "1" }
                                                  }
                                                },
                                                {
                                                  "post": {
                                                    "pk": "reply_999",
                                                    "code": "ReplyCode1",
                                                    "caption": { "text": "First reply comment" },
                                                    "user": { "username": "commenter", "pk": "2" }
                                                  }
                                                }
                                              ]
                                            }
                                          }
                                        ]
                                      }
                                    }
                                  }
                                }
                              }
                            ]
                          ]
                        ]
                      }
                    }
                  ]
                ]
              ]
            }
          </script>
        </body>
      </html>
    `;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    });

    const res = await getPostReplies('DFu1_MVz6SE', { fetchFn: mockFetch, tree: true });
    assert.equal(res.status, 'ok');
    assert.equal(res.rootPost.id, 'root_999');
    assert.equal(res.count, 1);
    assert.equal(res.replies[0].id, 'reply_999');
    assert.equal(res.replies[0].text, 'First reply comment');
    assert.ok(res.tree);
    assert.ok(res.tree_ascii);
  });

  it('resolves cookie from string, JSON string, and file paths', async () => {
    const { resolveCookie, parseCookieInput } = await import('../src/index.js');
    assert.equal(parseCookieInput('sessionid=123'), 'sessionid=123');
    assert.equal(
      parseCookieInput('[{"name":"sessionid","value":"xyz"}]'),
      'sessionid=xyz'
    );
  });
});

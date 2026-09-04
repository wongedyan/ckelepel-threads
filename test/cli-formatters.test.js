import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCsv,
  formatProfileCsv,
  formatPostsCsv,
  formatRepliesCsv,
  formatProfileStdout,
  formatPostsStdout,
  formatRepliesStdout,
} from '../src/index.js';

describe('ckelepel-threads CLI formatting & CSV tests', () => {
  const sampleProfile = {
    status: 'ok',
    profile: {
      id: '12345',
      username: 'jennie_official',
      full_name: 'Jennie Kim',
      biography: 'Chic and stylish',
      follower_count: 85000000,
      following_count: 5,
      metrics: {
        followers_count: 85000000,
        following_count: 5,
        posts_count: 120,
      },
      is_verified: true,
      is_private: false,
      url: 'https://www.threads.com/@jennie_official',
      external_url: 'https://youtube.com',
    },
    recent_posts: [
      {
        id: 'post_1',
        code: 'CODE123',
        caption: 'OOTD today in Paris',
        like_count: 500000,
        reply_count: 12000,
        taken_at: 1700000000,
      },
    ],
  };

  const samplePosts = {
    status: 'ok',
    username: 'jennie_official',
    count: 1,
    posts: [
      {
        id: 'p100',
        code: 'XYZ987',
        user: { username: 'jennie_official', is_verified: true, id: '12345' },
        caption: 'Hello Paris Fashion Week!',
        metrics: { likes: 1000, replies: 50, reposts: 20, quotes: 5 },
        like_count: 1000,
        reply_count: 50,
        taken_at: 1700000000,
        url: 'https://www.threads.com/t/XYZ987',
        has_media: true,
        media: [{ type: 'image', url: 'https://example.com/pic.jpg' }],
      },
    ],
  };

  const sampleReplies = {
    status: 'ok',
    rootPost: {
      id: 'root_001',
      code: 'ROOT123',
      caption: 'What is your favorite track?',
      user: { username: 'jennie_official' },
      url: 'https://www.threads.com/t/ROOT123',
    },
    count: 1,
    replies: [
      {
        id: 'rep_001',
        post_id: 'root_001',
        parent_id: 'root_001',
        code: 'REP123',
        username: 'blink_fan',
        user_id: '999',
        is_verified: false,
        text: 'Solo & You and Me!',
        like_count: 45,
        taken_at: 1700000050,
        url: 'https://www.threads.com/t/REP123',
      },
    ],
    tree_ascii: '[ROOT] @jennie_official: What is your favorite track?\n└── @blink_fan: Solo & You and Me!',
  };

  it('toCsv properly escapes strings with quotes and commas', () => {
    const data = [
      { name: 'Jennie, Kim', bio: 'Said "hello"' },
      { name: 'Normal', bio: 'Just text' },
    ];
    const csv = toCsv(data);
    assert.ok(csv.includes('"Jennie, Kim"'));
    assert.ok(csv.includes('"Said ""hello"""'));
  });

  it('formatProfileCsv formats profile data into valid CSV rows', () => {
    const csv = formatProfileCsv(sampleProfile);
    assert.ok(csv.includes('"id","username","full_name"'));
    assert.ok(csv.includes('"jennie_official"'));
    assert.ok(csv.includes('"Jennie Kim"'));
    assert.ok(csv.includes('85000000'));
  });

  it('formatPostsCsv outputs CSV lines with headers', () => {
    const csv = formatPostsCsv(samplePosts);
    assert.ok(csv.includes('"id","code","username"'));
    assert.ok(csv.includes('"p100"'));
    assert.ok(csv.includes('"XYZ987"'));
    assert.ok(csv.includes('"Hello Paris Fashion Week!"'));
  });

  it('formatRepliesCsv outputs valid CSV structure', () => {
    const csv = formatRepliesCsv(sampleReplies);
    assert.ok(csv.includes('"id","post_id","parent_id","code"'));
    assert.ok(csv.includes('"rep_001"'));
    assert.ok(csv.includes('"Solo & You and Me!"'));
  });

  it('formatProfileStdout renders readable text', () => {
    const text = formatProfileStdout(sampleProfile);
    assert.ok(text.includes('=== Threads Profile: @jennie_official ==='));
    assert.ok(text.includes('Full Name:   Jennie Kim [Verified]'));
    assert.ok(text.includes('OOTD today in Paris'));
  });

  it('formatPostsStdout renders readable text list', () => {
    const text = formatPostsStdout(samplePosts);
    assert.ok(text.includes('Posts for @jennie_official (1)'));
    assert.ok(text.includes('@jennie_official [✓]'));
    assert.ok(text.includes('Hello Paris Fashion Week!'));
  });

  it('formatRepliesStdout outputs ascii tree when available', () => {
    const text = formatRepliesStdout(sampleReplies);
    assert.ok(text.includes('=== Root Post: @jennie_official [ROOT123] ==='));
    assert.ok(text.includes('=== Reply Tree ==='));
    assert.ok(text.includes('└── @blink_fan: Solo & You and Me!'));
  });
});

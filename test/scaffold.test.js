import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, getProfile, getUserPosts, searchThreads, getPostReplies } from '../src/index.js';

describe('ckelepel-threads scaffolding verification', () => {
  it('exports semantic version', () => {
    assert.equal(VERSION, '0.1.0');
  });

  it('exports core scraper function signatures', () => {
    assert.equal(typeof getProfile, 'function');
    assert.equal(typeof getUserPosts, 'function');
    assert.equal(typeof searchThreads, 'function');
    assert.equal(typeof getPostReplies, 'function');
  });
});

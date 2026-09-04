import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../bin/ckelepel.js');

describe('ckelepel CLI end-to-end interface commands & flags', () => {
  it('outputs help menu with all required commands and options', async () => {
    const { stdout } = await execFileAsync('node', [binPath, '--help']);
    assert.ok(stdout.includes('Usage: ckelepel [options] [command]'));
    assert.ok(stdout.includes('profile'));
    assert.ok(stdout.includes('posts'));
    assert.ok(stdout.includes('search'));
    assert.ok(stdout.includes('replies'));
  });

  it('profile command exhibits correct flag options in help', async () => {
    const { stdout } = await execFileAsync('node', [binPath, 'profile', '--help']);
    assert.ok(stdout.includes('-o, --format <type>'));
    assert.ok(stdout.includes('--json'));
    assert.ok(stdout.includes('--csv'));
    assert.ok(stdout.includes('-c, --cookie <string>'));
    assert.ok(stdout.includes('--proxy <url>'));
    assert.ok(stdout.includes('-p, --posts'));
  });

  it('posts command exhibits correct flag options in help', async () => {
    const { stdout } = await execFileAsync('node', [binPath, 'posts', '--help']);
    assert.ok(stdout.includes('-l, --limit <number>'));
    assert.ok(stdout.includes('-o, --format <type>'));
    assert.ok(stdout.includes('--json'));
    assert.ok(stdout.includes('--csv'));
    assert.ok(stdout.includes('-c, --cookie <string>'));
    assert.ok(stdout.includes('--proxy <url>'));
  });

  it('search command exhibits correct flag options in help', async () => {
    const { stdout } = await execFileAsync('node', [binPath, 'search', '--help']);
    assert.ok(stdout.includes('-l, --limit <number>'));
    assert.ok(stdout.includes('--no-strict'));
    assert.ok(stdout.includes('-o, --format <type>'));
    assert.ok(stdout.includes('--json'));
    assert.ok(stdout.includes('--csv'));
    assert.ok(stdout.includes('-c, --cookie <string>'));
    assert.ok(stdout.includes('--proxy <url>'));
  });

  it('replies command exhibits correct flag options in help', async () => {
    const { stdout } = await execFileAsync('node', [binPath, 'replies', '--help']);
    assert.ok(stdout.includes('-l, --limit <number>'));
    assert.ok(stdout.includes('--no-tree'));
    assert.ok(stdout.includes('-o, --format <type>'));
    assert.ok(stdout.includes('--json'));
    assert.ok(stdout.includes('--csv'));
    assert.ok(stdout.includes('-c, --cookie <string>'));
    assert.ok(stdout.includes('--proxy <url>'));
  });

  it('profile fails gracefully on non-existent or invalid network target without throwing unhandled exception', async () => {
    try {
      await execFileAsync('node', [binPath, 'profile', 'an_impossible_fake_user_name_xyz_123456789']);
      assert.fail('Should have exited with code 1');
    } catch (err) {
      assert.equal(err.code, 1);
      assert.ok(err.stderr.includes('[Error]'));
    }
  });
});

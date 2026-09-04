#!/usr/bin/env node

import fs from 'node:fs';
import { Command } from 'commander';
import {
  VERSION,
  getProfile,
  getUserPosts,
  searchThreads,
  getPostReplies,
  resolveCookie,
} from '../src/index.js';
import {
  formatProfileCsv,
  formatPostsCsv,
  formatRepliesCsv,
} from '../src/csv.js';
import {
  formatProfileStdout,
  formatPostsStdout,
  formatRepliesStdout,
} from '../src/formatters.js';

function renderOutput(data, format, formatters) {
  const chosen = (format || 'stdout').toLowerCase();
  if (chosen === 'json') {
    return JSON.stringify(data, null, 2);
  }
  if (chosen === 'csv') {
    return formatters.csv(data);
  }
  return formatters.stdout(data);
}

function resolveProxy(cliProxy) {
  return (
    cliProxy ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    undefined
  );
}

const program = new Command();

program
  .name('ckelepel')
  .description('Pure standalone Meta Threads scraper CLI')
  .version(VERSION);

program
  .command('profile')
  .description('Fetch a Threads user profile')
  .argument('<username>', 'Threads handle without @')
  .option('-p, --posts', 'Include recent posts in output', false)
  .option('-l, --limit <number>', 'Number of recent posts to include', (val) => parseInt(val, 10), 10)
  .option('-o, --format <type>', 'Output format: stdout, json, csv', 'stdout')
  .option('--json', 'Shortcut for --format json')
  .option('--csv', 'Shortcut for --format csv')
  .option('-c, --cookie <string>', 'Threads session cookie (or env THREADS_COOKIE / COOKIE)')
  .option('--proxy <url>', 'Proxy URL (e.g. http://user:pass@host:port)')
  .action(async (username, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const data = await getProfile(username, {
        fetchPosts: options.posts,
        limit: options.limit,
        cookie,
        proxy,
      });

      let format = options.format;
      if (options.json) format = 'json';
      if (options.csv) format = 'csv';

      const output = renderOutput(data, format, {
        stdout: formatProfileStdout,
        csv: formatProfileCsv,
      });
      console.log(output);
    } catch (err) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('posts')
  .description('Fetch posts for a user')
  .argument('<username>', 'Threads handle without @')
  .option('-l, --limit <number>', 'Number of posts to fetch', (val) => parseInt(val, 10), 20)
  .option('-o, --format <type>', 'Output format: stdout, json, csv', 'stdout')
  .option('--json', 'Shortcut for --format json')
  .option('--csv', 'Shortcut for --format csv')
  .option('-c, --cookie <string>', 'Threads session cookie (or env THREADS_COOKIE / COOKIE)')
  .option('--proxy <url>', 'Proxy URL (e.g. http://user:pass@host:port)')
  .action(async (username, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const data = await getUserPosts(username, {
        limit: options.limit,
        cookie,
        proxy,
      });

      let format = options.format;
      if (options.json) format = 'json';
      if (options.csv) format = 'csv';

      const output = renderOutput(data, format, {
        stdout: formatPostsStdout,
        csv: formatPostsCsv,
      });
      console.log(output);
    } catch (err) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search posts on Threads')
  .argument('<query>', 'Search keyword or query')
  .option('-l, --limit <number>', 'Maximum posts to fetch', (val) => parseInt(val, 10), 20)
  .option('--no-strict', 'Disable strict keyword matching filter')
  .option('-o, --format <type>', 'Output format: stdout, json, csv', 'stdout')
  .option('--json', 'Shortcut for --format json')
  .option('--csv', 'Shortcut for --format csv')
  .option('-c, --cookie <string>', 'Threads session cookie (or env THREADS_COOKIE / COOKIE)')
  .option('--proxy <url>', 'Proxy URL (e.g. http://user:pass@host:port)')
  .action(async (query, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const data = await searchThreads(query, {
        limit: options.limit,
        strict: options.strict,
        cookie,
        proxy,
      });

      let format = options.format;
      if (options.json) format = 'json';
      if (options.csv) format = 'csv';

      const output = renderOutput(data, format, {
        stdout: formatPostsStdout,
        csv: formatPostsCsv,
      });
      console.log(output);
    } catch (err) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('replies')
  .description('Fetch comments and reply trees for a post')
  .argument('<url_or_code>', 'Post URL or shortcode')
  .option('-l, --limit <number>', 'Maximum replies to fetch', (val) => parseInt(val, 10), 30)
  .option('--no-tree', 'Do not build visual reply tree')
  .option('-o, --format <type>', 'Output format: stdout, json, csv', 'stdout')
  .option('--json', 'Shortcut for --format json')
  .option('--csv', 'Shortcut for --format csv')
  .option('-c, --cookie <string>', 'Threads session cookie (or env THREADS_COOKIE / COOKIE)')
  .option('--proxy <url>', 'Proxy URL (e.g. http://user:pass@host:port)')
  .action(async (url_or_code, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const data = await getPostReplies(url_or_code, {
        limit: options.limit,
        tree: options.tree,
        cookie,
        proxy,
      });

      let format = options.format;
      if (options.json) format = 'json';
      if (options.csv) format = 'csv';

      const output = renderOutput(data, format, {
        stdout: formatRepliesStdout,
        csv: formatRepliesCsv,
      });
      console.log(output);
    } catch (err) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

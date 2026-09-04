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
  ThreadsDatasetDB,
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

function saveToDataset(options, data, type) {
  if (!options.dataset && !options.db) return null;
  const db = new ThreadsDatasetDB(options.db);
  const dsName = typeof options.dataset === 'string' ? options.dataset : 'default';

  try {
    if (type === 'profile') {
      db.upsertProfile(data);
      if (Array.isArray(data.recent_posts) && data.recent_posts.length > 0) {
        db.upsertPosts(dsName, data.recent_posts);
      }
    } else if (type === 'posts') {
      if (Array.isArray(data.posts)) {
        db.upsertPosts(dsName, data.posts);
      }
    } else if (type === 'search') {
      if (Array.isArray(data.results)) {
        db.upsertPosts(dsName, data.results);
      }
    } else if (type === 'replies') {
      if (data.rootPost) {
        db.upsertPosts(dsName, [data.rootPost]);
      }
      if (Array.isArray(data.replies) && data.replies.length > 0) {
        db.upsertReplies(data.rootPost?.id, data.replies);
      }
    }
    return db;
  } finally {
    db.close();
  }
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
  .option('--dataset [name]', 'Save results into SQLite dataset database (default: "default")')
  .option('--db <path>', 'Custom SQLite database file path')
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

      saveToDataset(options, data, 'profile');

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
  .option('--dataset [name]', 'Save results into SQLite dataset database (default: "default")')
  .option('--db <path>', 'Custom SQLite database file path')
  .action(async (username, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const data = await getUserPosts(username, {
        limit: options.limit,
        cookie,
        proxy,
      });

      saveToDataset(options, data, 'posts');

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
  .description('Search posts on Threads (accepts single query or comma-separated multi-queries)')
  .argument('<query>', 'Search keyword, phrase, or comma-separated multi-queries (e.g. "ai, machine learning")')
  .option('-l, --limit <number>', 'Maximum posts to fetch', (val) => parseInt(val, 10), 20)
  .option('--no-strict', 'Disable strict keyword matching filter')
  .option('-o, --format <type>', 'Output format: stdout, json, csv', 'stdout')
  .option('--json', 'Shortcut for --format json')
  .option('--csv', 'Shortcut for --format csv')
  .option('-c, --cookie <string>', 'Threads session cookie (or env THREADS_COOKIE / COOKIE)')
  .option('--proxy <url>', 'Proxy URL (e.g. http://user:pass@host:port)')
  .option('--dataset [name]', 'Save results into SQLite dataset database (default: "default")')
  .option('--db <path>', 'Custom SQLite database file path')
  .action(async (query, options) => {
    try {
      const cookie = resolveCookie(options.cookie);
      const proxy = resolveProxy(options.proxy);
      const parsedQueries = query.includes(',') ? query.split(',').map(s => s.trim()).filter(Boolean) : query;
      const data = await searchThreads(parsedQueries, {
        limit: options.limit,
        strict: options.strict,
        cookie,
        proxy,
      });

      saveToDataset(options, data, 'search');

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
  .option('--dataset [name]', 'Save results into SQLite dataset database (default: "default")')
  .option('--db <path>', 'Custom SQLite database file path')
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

      saveToDataset(options, data, 'replies');

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

program
  .command('dataset')
  .description('Manage or inspect local SQLite dataset database')
  .option('--db <path>', 'Custom SQLite database file path')
  .action(async (options) => {
    try {
      const db = new ThreadsDatasetDB(options.db);
      const datasets = db.listDatasets();
      db.close();

      console.log('=== Local Threads Datasets ===');
      if (datasets.length === 0) {
        console.log('No datasets found. Use --dataset <name> on scrape commands to collect posts.');
      } else {
        for (const ds of datasets) {
          console.log(`- [${ds.name}] Posts: ${ds.post_count} | Updated: ${new Date(ds.updated_at * 1000).toISOString()}`);
        }
      }
    } catch (err) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

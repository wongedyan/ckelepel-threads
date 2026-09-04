import fs from 'node:fs';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

export const SEARCH_DOC_ID = '28488931787378929';
export const PROFILE_POSTS_DOC_ID = '28060185173641715';
export const REPLIES_DOC_ID = '37791490057164579';
export const THREADS_GRAPHQL_ENDPOINT = 'https://www.threads.com/graphql/query';

export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'X-FB-LSD': 'AdT1DBzgGffd0Si5YthcWTZ7ilo',
  'X-ASBD-ID': '129477',
  'X-IG-App-ID': '238260118697367',
};

export function getDispatcher(proxyUrl) {
  const targetProxy =
    proxyUrl ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY;
  if (targetProxy) {
    return new ProxyAgent(targetProxy);
  }
  return undefined;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseCookieInput(input) {
  if (!input) return undefined;
  const trimmed = input.trim();
  let content = trimmed;

  if (fs.existsSync(trimmed)) {
    try {
      content = fs.readFileSync(trimmed, 'utf-8').trim();
    } catch {}
  }

  if (content.startsWith('[') || content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => c && c.name && c.value !== undefined)
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }
    } catch {}
  }

  return content;
}

export function resolveCookie(cookieInput) {
  const candidate =
    cookieInput ||
    process.env.THREADS_COOKIE ||
    process.env.COOKIE ||
    process.env.THREADS_COOKIES ||
    undefined;
  return parseCookieInput(candidate);
}

export function jitterDelay(minMs = 150, maxMs = 350) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export async function fetchWithRetry(url, options = {}, retryConfig = {}) {
  const maxRetries = retryConfig.maxRetries ?? 2;
  const initialDelay = retryConfig.initialDelayMs ?? 300;
  const fetchImpl = retryConfig.fetchFn || undiciFetch;

  let lastError = null;
  let delay = initialDelay;

  const requestOptions = {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  };

  const cookie = resolveCookie(options.cookie);
  if (cookie) {
    requestOptions.headers['Cookie'] = cookie;
  }

  if (!requestOptions.dispatcher) {
    const dispatcher = getDispatcher(options.proxy);
    if (dispatcher) {
      requestOptions.dispatcher = dispatcher;
    }
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const res = await fetchImpl(url, requestOptions);
      if ((res.status === 429 || res.status >= 500) && attempt <= maxRetries) {
        await sleep(delay + jitterDelay(50, 150));
        delay *= 2;
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt <= maxRetries) {
        await sleep(delay + jitterDelay(50, 150));
        delay *= 2;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

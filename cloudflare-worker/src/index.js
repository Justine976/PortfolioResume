import { DurableObject } from "cloudflare:workers";

const MAX_HISTORY = 10;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

const PINNED_CACHE_TTL_SECONDS = 3600;
const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

// Parses pinned repository names (in pin order) from a GitHub profile page.
// Each pinned item block contains a link like href="/username/RepoName".
function extractPinnedRepos(html, username) {
  const pattern = new RegExp(
    `pinned-item-list-item-content[\\s\\S]{0,2000}?href="/${username}/([A-Za-z0-9._-]+)"`,
    "g"
  );
  const pinned = [];
  let match;

  while ((match = pattern.exec(html)) !== null) {
    if (!pinned.includes(match[1])) pinned.push(match[1]);
  }

  return pinned;
}

async function fetchPinnedRepos(username) {
  const response = await fetch(`https://github.com/${username}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "portfolio-pinned-repos-fetcher"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub profile error ${response.status}`);
  }

  return extractPinnedRepos(await response.text(), username);
}

async function handlePinnedRequest(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || "";

  if (!GITHUB_USERNAME_PATTERN.test(username)) {
    return json({ error: "Invalid username" }, 400);
  }

  // Cache per user at the edge so GitHub is not hit on every page view.
  const cache = caches.default;
  const cacheKey = new Request(`https://pinned-repos.cache/${username}.json`, {
    method: "GET"
  });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const pinned = await fetchPinnedRepos(username);
    const response = json({ pinned });
    response.headers.set(
      "Cache-Control",
      `public, max-age=${PINNED_CACHE_TTL_SECONDS}`
    );
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    console.error("Error fetching pinned repositories:", error);
    return json({ pinned: [], error: "Pinned repositories unavailable" }, 502);
  }
}

const PROJECT_DETAILS_CACHE_TTL_SECONDS = 3600;
const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "portfolio-project-details-fetcher"
};
const MAX_CONCURRENT_GITHUB_REQUESTS = 5;

async function fetchGithubJson(url) {
  const response = await fetch(url, { headers: GITHUB_API_HEADERS });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${url}`);
  }

  return response.json();
}

// Runs an async mapper over items with a bounded number of concurrent requests.
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function runQueue() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runQueue())
  );

  return results;
}

// Skips common README images that make poor previews: emoji, CI/build badges.
const README_IMAGE_SKIP_PATTERN = /emoji|shields\.io|badge|travis-ci|circleci|codecov/i;

// GitHub proxies README images through camo.githubusercontent.com with the
// original URL hex-encoded in the path. Decode it so badge filtering can
// inspect the real destination (e.g. a shields.io license badge).
function resolveCamoUrl(url) {
  const match = url.match(
    /^https?:\/\/camo\.githubusercontent\.com\/[a-f0-9]+\/([a-f0-9]+)$/i
  );

  if (!match) return url;

  let decoded = "";
  for (let i = 0; i < match[1].length; i += 2) {
    decoded += String.fromCharCode(parseInt(match[1].slice(i, i + 2), 16));
  }

  return decoded || url;
}

// Extracts the first usable image URL from a repo's rendered README HTML.
// GitHub rewrites relative image paths to absolute URLs, so any screenshot
// or demo GIF committed to the repo (or its /docs or /screenshots folder)
// works as a preview for desktop/software projects with no live site.
function extractReadmeImage(html) {
  if (typeof html !== "string") return null;

  const pattern = /<img[^>]*\ssrc="([^"]+)"/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    if (!README_IMAGE_SKIP_PATTERN.test(resolveCamoUrl(match[1]))) {
      return match[1];
    }
  }

  return null;
}

// Fetches a repo's README rendered as HTML and returns its first usable
// image URL, or null when the repo has no README or no suitable image.
async function fetchReadmePreview(baseUrl) {
  const response = await fetch(`${baseUrl}/readme`, {
    headers: { ...GITHUB_API_HEADERS, Accept: "application/vnd.github.html+json" }
  }).catch(() => null);

  if (!response || !response.ok) return null;

  return extractReadmeImage(await response.text());
}

// Collects the full tech stack for every repository: complete language
// breakdown (with byte sizes), topics, description, homepage, and the first
// usable image from the README (for software projects without a live site).
async function fetchAllProjectDetails(username) {
  const repos = await fetchGithubJson(
    `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`
  );

  if (!Array.isArray(repos)) {
    throw new Error("Unexpected GitHub API response");
  }

  const entries = await mapWithConcurrency(repos, MAX_CONCURRENT_GITHUB_REQUESTS, async (repo) => {
    const baseUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}`;
    // README images only matter for projects without a live site, so skip
    // the extra GitHub API request for repos that do have one (keeps the
    // unauthenticated 60 req/hour GitHub API budget healthy).
    const needsReadmePreview = !repo.homepage && !repo.has_pages;
    const [repoInfo, languages, readmePreview] = await Promise.all([
      fetchGithubJson(baseUrl).catch(() => null),
      fetchGithubJson(`${baseUrl}/languages`).catch(() => ({})),
      needsReadmePreview ? fetchReadmePreview(baseUrl) : Promise.resolve(null)
    ]);

    return [
      repo.name,
      {
        description: repoInfo?.description || null,
        homepage: repoInfo?.homepage || repo.homepage || null,
        topics: Array.isArray(repoInfo?.topics) ? repoInfo.topics : [],
        previewImage: readmePreview || null,
        languages:
          languages && typeof languages === "object" && !Array.isArray(languages)
            ? languages
            : {}
      }
    ];
  });

  return Object.fromEntries(entries);
}

async function handleProjectDetailsRequest(request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || "";

  if (!GITHUB_USERNAME_PATTERN.test(username)) {
    return json({ error: "Invalid username" }, 400);
  }

  // Cache per user at the edge so GitHub's API rate limit is not exhausted.
  const cache = caches.default;
  const cacheKey = new Request(
    `https://project-details.cache/${username}.json`,
    { method: "GET" }
  );
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const details = await fetchAllProjectDetails(username);
    const response = json({ details });
    response.headers.set(
      "Cache-Control",
      `public, max-age=${PROJECT_DETAILS_CACHE_TTL_SECONDS}`
    );
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    console.error("Error fetching project details:", error);
    return json(
      { details: {}, error: "Project details unavailable" },
      502
    );
  }
}

function cleanText(value, fallback) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : fallback;
}

function cleanDevice(device) {
  return {
    type: cleanText(device?.type, "Unknown device"),
    browser: cleanText(device?.browser, "Browser"),
    os: cleanText(device?.os, "Unknown OS"),
    screen: cleanText(device?.screen, "Unknown screen"),
    language: cleanText(device?.language, "Unknown language")
  };
}

function publicStats(stats) {
  return {
    total: stats.total,
    history: stats.history.map(({ id, ...visit }) => visit)
  };
}

function defaultStats() {
  return { total: 0, history: [] };
}

export class VisitorCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async getStats() {
    return publicStats(await this.readStats());
  }

  async recordVisit(visit) {
    const stats = await this.readStats();
    const now = Date.now();
    const visitorId = cleanText(visit?.visitorId, globalThis.crypto.randomUUID());
    const existingVisit = stats.history.find((item) => item.id === visitorId);

    if (existingVisit) {
      existingVisit.lastSeen = now;
      existingVisit.views = (Number.isFinite(existingVisit.views) ? existingVisit.views : 1) + 1;
      existingVisit.device = cleanDevice(visit?.device);
    } else {
      stats.total += 1;
      stats.history.unshift({
        id: visitorId,
        count: stats.total,
        timestamp: now,
        lastSeen: now,
        views: 1,
        country: cleanText(visit?.country, "Unknown"),
        device: cleanDevice(visit?.device)
      });
    }

    stats.history = stats.history.slice(0, MAX_HISTORY);
    await this.ctx.storage.put("stats", stats);

    return publicStats(stats);
  }

  async readStats() {
    const stats = (await this.ctx.storage.get("stats")) || defaultStats();

    return {
      total: Number.isFinite(stats.total) ? stats.total : 0,
      history: Array.isArray(stats.history) ? stats.history : []
    };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const counter = env.VISITOR_COUNTER.getByName("global");

    if (url.pathname === "/stats" && request.method === "GET") {
      return json(await counter.getStats());
    }

    if (url.pathname === "/pinned" && request.method === "GET") {
      return handlePinnedRequest(request);
    }

    if (url.pathname === "/project-details" && request.method === "GET") {
      return handleProjectDetailsRequest(request);
    }

    if (url.pathname === "/visit" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));

      return json(await counter.recordVisit({
        visitorId: body.visitorId,
        device: body.device,
        country: request.cf?.country || "Unknown"
      }));
    }

    return json({ error: "Not found" }, 404);
  }
};

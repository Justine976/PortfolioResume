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

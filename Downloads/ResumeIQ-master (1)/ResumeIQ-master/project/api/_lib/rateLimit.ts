import type { VercelRequest } from '@vercel/node';

const REQUESTS_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

/** In-memory sliding window (per serverless instance — use Upstash in production). */
const memoryBuckets = new Map<string, number[]>();

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function upstashPipeline(commands: unknown[]): Promise<unknown[] | null> {
  const config = getUpstashConfig();
  if (!config) return null;

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { result?: unknown[] };
    return Array.isArray(data.result) ? data.result : null;
  } catch {
    return null;
  }
}

async function checkUpstashNamedRateLimit(
  key: string,
  requestsPerMinute: number,
): Promise<{ allowed: boolean; retryAfter: number } | null> {
  const windowKey = Math.floor(Date.now() / WINDOW_MS);
  const redisKey = `${key}:${windowKey}`;

  const results = await upstashPipeline([
    ['INCR', redisKey],
    ['EXPIRE', redisKey, Math.ceil(WINDOW_MS / 1000)],
  ]);

  if (!results || results.length < 1) return null;

  const count = Number(results[0]);
  if (Number.isNaN(count)) return null;

  if (count > requestsPerMinute) {
    const msIntoWindow = Date.now() % WINDOW_MS;
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - msIntoWindow) / 1000));
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

function checkMemoryNamedRateLimit(
  bucketKey: string,
  requestsPerMinute: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = memoryBuckets.get(bucketKey) ?? [];
  const recent = existing.filter((ts) => now - ts < WINDOW_MS);

  if (recent.length >= requestsPerMinute) {
    const oldest = recent[0] ?? now;
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  memoryBuckets.set(bucketKey, recent);
  return { allowed: true, retryAfter: 0 };
}

async function enforceNamedRateLimit(
  bucketKey: string,
  requestsPerMinute: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const upstash = await checkUpstashNamedRateLimit(bucketKey, requestsPerMinute);
  if (upstash) return upstash;
  return checkMemoryNamedRateLimit(bucketKey, requestsPerMinute);
}

/** Limit AI routes to 10 requests per user per minute. */
export async function enforceAiRateLimit(
  userId: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  return enforceNamedRateLimit(`ratelimit:ai:${userId}`, REQUESTS_PER_MINUTE);
}

/** Limit billing routes to 15 requests per user per minute. */
export async function enforceBillingRateLimit(
  userId: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  return enforceNamedRateLimit(`ratelimit:billing:${userId}`, 15);
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || 'unknown';
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp.trim();
  return 'unknown';
}

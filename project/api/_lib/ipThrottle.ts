const TWENTY_FOUR_HOURS_SEC = 86_400;

/** In-memory IP throttle (per serverless instance). */
const memoryIpSubmitAt = new Map<string, number>();

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function upstashCommand(command: unknown[]): Promise<unknown | null> {
  const config = getUpstashConfig();
  if (!config) return null;

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { result?: unknown };
    return data.result ?? null;
  } catch {
    return null;
  }
}

/** Returns true if this IP submitted within the last 24 hours. */
export async function isIpRecentlySubmitted(ip: string): Promise<boolean> {
  const normalized = ip.trim() || 'unknown';
  const redisKey = `testimonial:ip:${normalized}`;

  const cached = await upstashCommand(['GET', redisKey]);
  if (cached !== null && cached !== undefined) {
    return true;
  }
  if (getUpstashConfig() && cached === null) {
    return false;
  }

  const last = memoryIpSubmitAt.get(normalized);
  if (!last) return false;
  return Date.now() - last < TWENTY_FOUR_HOURS_SEC * 1000;
}

export async function markIpSubmitted(ip: string): Promise<void> {
  const normalized = ip.trim() || 'unknown';
  const redisKey = `testimonial:ip:${normalized}`;

  await upstashCommand(['SET', redisKey, '1', 'EX', TWENTY_FOUR_HOURS_SEC]);
  memoryIpSubmitAt.set(normalized, Date.now());
}

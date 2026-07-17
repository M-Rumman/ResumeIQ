import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  logOpenRouterDiagnostics,
  maskApiKey,
  readOpenRouterKeyFromEnv,
} from './_lib/openrouterDiagnostics.js';
import { getAppBaseUrl } from './_lib/appUrl.js';

function isAuthorizedHealthCheck(req: VercelRequest): boolean {
  const secret = process.env.AI_HEALTH_SECRET?.trim();
  if (!secret) return process.env.VERCEL_ENV !== 'production';

  const header = req.headers['x-ai-health-secret'];
  const provided = Array.isArray(header) ? header[0] : header;
  return provided === secret;
}

/** Runtime diagnostic — disabled in production unless AI_HEALTH_SECRET header is sent. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorizedHealthCheck(req)) {
    return res.status(404).json({ error: 'Not found' });
  }

  logOpenRouterDiagnostics('ai-health');

  const key = readOpenRouterKeyFromEnv();
  let openRouterStatus: number | null = null;
  let openRouterOk = false;
  let openRouterError: string | null = null;

  const probeOpenRouter = req.query.probe === '1' || req.query.probe === 'true';

  if (probeOpenRouter && key.startsWith('sk-or-')) {
    try {
      const probe = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': getAppBaseUrl(),
          'X-Title': 'ResuV',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-235b-a22b:free',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      openRouterStatus = probe.status;
      openRouterOk = probe.ok;
      if (!probe.ok) {
        openRouterError = (await probe.text()).slice(0, 200);
      }
    } catch (err) {
      openRouterError = err instanceof Error ? err.message : 'Probe failed';
    }
  }

  return res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    appUrl: getAppBaseUrl(),
    appUrlEnv: process.env.APP_URL ?? null,
    openrouterKey: maskApiKey(key),
    openrouterKeyConfigured: key.length > 0,
    openrouterKeyValidFormat: key.startsWith('sk-or-'),
    openRouterProbe: probeOpenRouter
      ? { ok: openRouterOk, status: openRouterStatus, error: openRouterError }
      : { skipped: true, hint: 'Add ?probe=1 to run OpenRouter ping (uses API credits)' },
  });
}

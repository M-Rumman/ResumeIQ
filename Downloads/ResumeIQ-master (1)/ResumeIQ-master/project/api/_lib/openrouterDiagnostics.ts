/** Safe server-side diagnostics for OpenRouter — never logs full API keys. */

import { getAppBaseUrl } from './appUrl.js';

export function maskApiKey(key: string): string {
  if (!key) return 'MISSING';
  if (key.length <= 12) return `present(len=${key.length})`;
  return `${key.slice(0, 8)}…${key.slice(-4)} (len=${key.length})`;
}

export function readOpenRouterKeyFromEnv(): string {
  const raw = process.env.OPENROUTER_API_KEY?.trim() ?? '';
  const key = raw.replace(/^['"]|['"]$/g, '').trim();
  // Vercel sometimes stores an empty placeholder — treat as missing.
  if (!key || key === 'undefined' || key === 'null') return '';
  return key;
}

export function logOpenRouterDiagnostics(context: string): void {
  const key = readOpenRouterKeyFromEnv();
  console.info(`[openrouter:${context}]`, {
    vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
    vercelUrl: process.env.VERCEL_URL ?? '(unset)',
    appUrl: getAppBaseUrl(),
    appUrlEnv: process.env.APP_URL ?? '(unset)',
    keyPresent: key.length > 0,
    keyMasked: maskApiKey(key),
    keyValidFormat: key.startsWith('sk-or-'),
  });
}

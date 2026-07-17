import { supabase } from '../supabase.js';

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('You must be logged in.');
  }

  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('You must be logged in.');
  }

  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), options.timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

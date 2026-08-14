import { supabase } from '../supabase.js';

export type ApiRequestErrorCode =
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_server_error'
  | 'malformed_response'
  | 'request_failed';

export type AiPipelineFailure = {
  stage: 'parser' | 'analyzer' | 'rewriter' | 'validation' | 'planner';
  code: string;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ApiRequestErrorCode,
    message: string,
    public readonly status?: number,
    public readonly pipelineError?: AiPipelineFailure,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function errorCodeForStatus(status: number): ApiRequestErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 504) return 'timeout';
  if (status === 500) return 'internal_server_error';
  if (status === 502 || status === 503) return 'service_unavailable';
  return 'request_failed';
}

async function parseJsonResponse<T>(response: Response): Promise<T & { error?: string; pipelineError?: AiPipelineFailure }> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T & { error?: string };
  } catch {
    throw new ApiRequestError(
      response.status >= 500 ? 'service_unavailable' : 'malformed_response',
      response.status >= 500
        ? 'The analysis service is temporarily unavailable.'
        : 'The analysis service returned an invalid response.',
      response.status,
    );
  }
}

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
    throw new ApiRequestError('unauthorized', 'You must be logged in.', 401);
  }

  const controller = options.timeoutMs ? new AbortController() : null;
  let timedOut = false;
  const timeout = controller
    ? window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs)
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
  } catch (error) {
    if (timedOut || controller?.signal.aborted) {
      throw new ApiRequestError('timeout', 'The request timed out.');
    }
    throw new ApiRequestError(
      'network',
      error instanceof Error ? error.message : 'Network request failed.',
    );
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }

  const data = await parseJsonResponse<T>(response);

  if (!response.ok) {
    throw new ApiRequestError(
      errorCodeForStatus(response.status),
      data.error || `Request failed (${response.status})`,
      response.status,
      data.pipelineError,
    );
  }

  return data;
}

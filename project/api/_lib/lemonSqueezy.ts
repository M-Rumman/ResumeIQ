import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { getPaymentSuccessUrl } from './appUrl.js';

export type CheckoutType = 'unlock' | 'pro';

export type LemonCustomData = {
  user_id: string;
  checkout_type: CheckoutType;
  report_id?: string;
};

export type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Partial<LemonCustomData> & Record<string, unknown>;
    webhook_id?: string;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
};

export function getLemonConfig() {
  const apiKey = process.env.LEMON_API_KEY?.trim();
  const webhookSecret = process.env.LEMON_WEBHOOK_SECRET?.trim();
  const storeId =
    process.env.VITE_LEMON_STORE_ID?.trim() || process.env.LEMON_STORE_ID?.trim();
  const unlockVariantId =
    process.env.VITE_LEMON_UNLOCK_VARIANT_ID?.trim() ||
    process.env.LEMON_UNLOCK_VARIANT_ID?.trim();
  const proVariantId =
    process.env.VITE_LEMON_PRO_VARIANT_ID?.trim() || process.env.LEMON_PRO_VARIANT_ID?.trim();

  return { apiKey, webhookSecret, storeId, unlockVariantId, proVariantId };
}

export function assertLemonCheckoutConfig() {
  const config = getLemonConfig();
  const missing: string[] = [];
  if (!config.apiKey) missing.push('LEMON_API_KEY');
  if (!config.storeId) missing.push('VITE_LEMON_STORE_ID');
  if (!config.unlockVariantId) missing.push('VITE_LEMON_UNLOCK_VARIANT_ID');
  if (!config.proVariantId) missing.push('VITE_LEMON_PRO_VARIANT_ID');
  if (missing.length > 0) {
    throw new Error(`Missing Lemon Squeezy configuration: ${missing.join(', ')}`);
  }
  return {
    apiKey: config.apiKey!,
    webhookSecret: config.webhookSecret!,
    storeId: config.storeId!,
    unlockVariantId: config.unlockVariantId!,
    proVariantId: config.proVariantId!,
  };
}

export async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.LEMON_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;

  const digest = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
    'utf8',
  );
  const signature = Buffer.from(signatureHeader, 'utf8');
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(digest, signature);
}

export function buildEventKey(payload: LemonWebhookPayload): string {
  const eventName = payload.meta?.event_name || 'unknown';
  const resourceType = payload.data?.type || 'unknown';
  const resourceId = payload.data?.id || 'unknown';
  const webhookId = payload.meta?.webhook_id;
  if (webhookId) return `${eventName}:${webhookId}`;
  return `${eventName}:${resourceType}:${resourceId}`;
}

export function getCustomData(payload: LemonWebhookPayload): LemonCustomData | null {
  const raw = payload.meta?.custom_data;
  if (!raw || typeof raw !== 'object') return null;
  const userId = typeof raw.user_id === 'string' ? raw.user_id : '';
  const checkoutType = raw.checkout_type;
  if (!userId || (checkoutType !== 'unlock' && checkoutType !== 'pro')) return null;
  const reportId = typeof raw.report_id === 'string' ? raw.report_id : undefined;
  return { user_id: userId, checkout_type: checkoutType, report_id: reportId };
}

export async function createLemonCheckout(options: {
  variantId: string;
  storeId: string;
  userId: string;
  userEmail?: string | null;
  checkoutType: CheckoutType;
  reportId?: string | null;
}): Promise<string> {
  const config = assertLemonCheckoutConfig();
  const custom: LemonCustomData = {
    user_id: options.userId,
    checkout_type: options.checkoutType,
  };
  if (options.checkoutType === 'unlock' && options.reportId) {
    custom.report_id = options.reportId;
  }

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: options.userEmail || undefined,
          custom,
        },
        product_options: {
          redirect_url: getPaymentSuccessUrl(),
          receipt_button_text: 'Return to ResuV',
        },
        checkout_options: {
          embed: false,
          media: true,
          logo: true,
        },
      },
      relationships: {
        store: {
          data: { type: 'stores', id: String(options.storeId) },
        },
        variant: {
          data: { type: 'variants', id: String(options.variantId) },
        },
      },
    },
  };

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as {
    data?: { attributes?: { url?: string } };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok) {
    const detail = json.errors?.[0]?.detail || `Lemon Squeezy checkout failed (${response.status})`;
    throw new Error(detail);
  }

  const url = json.data?.attributes?.url;
  if (!url) throw new Error('Lemon Squeezy did not return a checkout URL.');
  return url;
}

export function getSubscriptionStatus(payload: LemonWebhookPayload): string {
  const status = payload.data?.attributes?.status;
  return typeof status === 'string' ? status.toLowerCase() : '';
}

export function getOrderStatus(payload: LemonWebhookPayload): string {
  const status = payload.data?.attributes?.status;
  return typeof status === 'string' ? status.toLowerCase() : '';
}

export function getResourceId(payload: LemonWebhookPayload): string | null {
  const id = payload.data?.id;
  return id != null ? String(id) : null;
}

export function getCustomerId(payload: LemonWebhookPayload): string | null {
  const customerId = payload.data?.attributes?.customer_id;
  return customerId != null ? String(customerId) : null;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Map Lemon subscription webhook attributes to profiles.subscription_expires_at.
 * @see https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
 */
export function getSubscriptionExpiresAt(payload: LemonWebhookPayload): string | null {
  const attrs = payload.data?.attributes;
  if (!attrs) return null;

  let status = getSubscriptionStatus(payload);
  if (status === 'paid') status = 'active';

  const trialEndsAt = parseIsoTimestamp(attrs.trial_ends_at);
  const endsAt = parseIsoTimestamp(attrs.ends_at);
  const renewsAt = parseIsoTimestamp(attrs.renews_at);

  if (status === 'on_trial') {
    return trialEndsAt ?? renewsAt;
  }

  if (status === 'cancelled' || status === 'expired') {
    return endsAt ?? renewsAt;
  }

  if (status === 'active' || status === 'past_due') {
    return renewsAt ?? endsAt;
  }

  if (status === 'paused') {
    const pause = attrs.pause;
    if (pause && typeof pause === 'object' && pause !== null) {
      const resumesAt = parseIsoTimestamp((pause as { resumes_at?: unknown }).resumes_at);
      if (resumesAt) return resumesAt;
    }
    return renewsAt;
  }

  return renewsAt ?? endsAt ?? trialEndsAt;
}

type LemonApiResource = {
  attributes?: {
    user_email?: string | null;
    email?: string | null;
    urls?: {
      customer_portal?: string | null;
    };
  };
};

type LemonApiResponse = {
  data?: LemonApiResource;
  errors?: Array<{ detail?: string; title?: string }>;
};

export function isValidCustomerPortalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:') return false;
    if (host === 'app.lemonsqueezy.com') return false;
    if (!parsed.pathname.includes('/billing')) return false;
    return true;
  } catch {
    return false;
  }
}

function extractResourceEmail(json: LemonApiResponse): string | null {
  const email = json.data?.attributes?.user_email ?? json.data?.attributes?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function assertEmailMatches(json: LemonApiResponse, expectedEmail: string | null): void {
  if (!expectedEmail) return;
  const resourceEmail = extractResourceEmail(json);
  if (!resourceEmail || resourceEmail === expectedEmail) return;
  throw new Error('Billing details do not match your account. Please contact support.');
}

async function lemonApiGet(path: string): Promise<LemonApiResponse> {
  const config = getLemonConfig();
  if (!config.apiKey) {
    throw new Error('Missing Lemon Squeezy configuration: LEMON_API_KEY');
  }

  const response = await fetch(`https://api.lemonsqueezy.com/v1/${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  const json = (await response.json()) as LemonApiResponse;

  if (!response.ok) {
    const detail =
      json.errors?.[0]?.detail ||
      json.errors?.[0]?.title ||
      `Lemon Squeezy request failed (${response.status})`;
    throw new Error(detail);
  }

  return json;
}

function extractCustomerPortalUrl(json: LemonApiResponse): string | null {
  const url = json.data?.attributes?.urls?.customer_portal;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

function resolveValidPortalUrl(json: LemonApiResponse, source: string): string | null {
  const raw = extractCustomerPortalUrl(json);
  if (!raw) return null;
  if (isValidCustomerPortalUrl(raw)) return raw;

  try {
    const parsed = new URL(raw);
    console.warn(
      '[lemonSqueezy/customer-portal]',
      JSON.stringify({
        message: 'rejected_invalid_portal_url',
        source,
        host: parsed.hostname,
        path: parsed.pathname,
      }),
    );
  } catch {
    console.warn(
      '[lemonSqueezy/customer-portal]',
      JSON.stringify({ message: 'rejected_invalid_portal_url', source }),
    );
  }

  return null;
}

/**
 * Fetch a signed Customer Portal URL (valid ~24h). Prefer subscription, then customer.
 * @see https://docs.lemonsqueezy.com/guides/developer-guide/customer-portal
 */
export async function getCustomerPortalUrl(options: {
  subscriptionId?: string | null;
  customerId?: string | null;
  userEmail?: string | null;
}): Promise<string> {
  const subscriptionId = options.subscriptionId?.trim() || null;
  const customerId = options.customerId?.trim() || null;
  const expectedEmail = options.userEmail?.trim().toLowerCase() || null;

  if (subscriptionId) {
    const subscription = await lemonApiGet(`subscriptions/${encodeURIComponent(subscriptionId)}`);
    assertEmailMatches(subscription, expectedEmail);
    const portalUrl = resolveValidPortalUrl(subscription, 'subscription');
    if (portalUrl) return portalUrl;
  }

  if (customerId) {
    const customer = await lemonApiGet(`customers/${encodeURIComponent(customerId)}`);
    assertEmailMatches(customer, expectedEmail);
    const portalUrl = resolveValidPortalUrl(customer, 'customer');
    if (portalUrl) return portalUrl;
  }

  throw new Error('Could not retrieve a billing portal link for your subscription.');
}

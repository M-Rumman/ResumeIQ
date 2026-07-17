import { apiPost } from './api/client.js';

export async function fetchManageSubscriptionUrl(): Promise<string> {
  const data = await apiPost<{ url: string }>('/api/manage-subscription', {});
  if (!data.url?.trim()) {
    throw new Error('No billing portal URL was returned. Please try again.');
  }
  return data.url.trim();
}

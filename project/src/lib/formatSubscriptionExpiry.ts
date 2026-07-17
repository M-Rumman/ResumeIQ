export function formatSubscriptionExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function canManageSubscription(
  isPro: boolean,
  userId: string | null | undefined,
): boolean {
  return Boolean(isPro && userId);
}

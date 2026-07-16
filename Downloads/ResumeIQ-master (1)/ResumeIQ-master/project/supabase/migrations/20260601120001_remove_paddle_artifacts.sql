-- Remove Paddle-specific columns (future payments: Lemon Squeezy via server webhooks only).

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS paddle_customer_id,
  DROP COLUMN IF EXISTS paddle_subscription_id;

-- Drop Paddle purchase log table if it exists (will be replaced when Lemon Squeezy is integrated).
DROP TABLE IF EXISTS public.purchase_events;

/** User-facing hint for AI failures — avoids showing "add API key" when the key is already set. */
export function getAiErrorHint(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  const onVercel =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('.vercel.app') ||
      !window.location.hostname.includes('localhost'));

  if (msg.includes('429') || msg.includes('rate-limit') || msg.includes('rate limited')) {
    return 'Free AI models are busy right now. Wait 30–60 seconds and try again. The app will automatically try other free models.';
  }

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('user not found')) {
    if (onVercel) {
      return 'OPENROUTER_API_KEY on Vercel is empty or invalid for Production. In Vercel → Settings → Environment Variables, set OPENROUTER_API_KEY to your sk-or-… key for Production (not an empty value), set APP_URL to https://resuv.app, then Redeploy production.';
    }
    return 'Your OpenRouter API key was rejected. Create a new key at openrouter.ai/keys, paste it into .env as OPENROUTER_API_KEY, then restart npm run dev:vercel.';
  }

  if (msg.includes('openrouter_api_key') || msg.includes('not configured')) {
    if (onVercel) {
      return 'OPENROUTER_API_KEY is not set on Vercel. Add it under Project Settings → Environment Variables (Production + Preview), then redeploy.';
    }
    return 'Add OPENROUTER_API_KEY to your .env file in the project folder, then restart npm run dev:vercel.';
  }

  if (msg.includes('404') && msg.includes('no endpoints')) {
    return 'The configured AI model is no longer available. Set OPENROUTER_MODEL in .env to a current free model from openrouter.ai/models (filter: free).';
  }

  if (onVercel) {
    return 'Check Vercel Environment Variables include OPENROUTER_API_KEY, then redeploy. For local dev, use .env and npm run dev:vercel.';
  }

  return 'Check that npm run dev:vercel is running and OPENROUTER_API_KEY is set in .env, then try again.';
}

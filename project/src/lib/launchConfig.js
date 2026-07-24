/**
 * Public-launch switch. Defaults to enabled so new deployments are safe by
 * default. Set VITE_FREE_LAUNCH_MODE=false when paid access is ready again.
 */
export const FREE_LAUNCH_MODE =
  import.meta.env.VITE_FREE_LAUNCH_MODE !== 'false' &&
  import.meta.env.VITE_FREE_LAUNCH_MODE !== '0';

export const FREE_LAUNCH_MESSAGE =
  'ResuV is currently FREE for everyone for a limited time. Enjoy unlimited Resume Analysis, Interview Preparation, and PDF Reports while this offer lasts.';

/**
 * Optional public-launch switch. Paid access is the normal default; set this
 * only when intentionally running a free promotional launch.
 */
export const FREE_LAUNCH_MODE =
  import.meta.env.VITE_FREE_LAUNCH_MODE === 'true' ||
  import.meta.env.VITE_FREE_LAUNCH_MODE === '1';

export const FREE_LAUNCH_MESSAGE =
  'ResuV is currently FREE for everyone for a limited time. Enjoy unlimited Resume Analysis, Interview Preparation, and PDF Reports while this offer lasts.';

export const PROTECTED_PAGES = ['analyzer', 'interview', 'interview-prep', 'dashboard'] as const;

export type ProtectedPage = (typeof PROTECTED_PAGES)[number];

export function isProtectedPage(page: string): page is ProtectedPage {
  return (PROTECTED_PAGES as readonly string[]).includes(page);
}

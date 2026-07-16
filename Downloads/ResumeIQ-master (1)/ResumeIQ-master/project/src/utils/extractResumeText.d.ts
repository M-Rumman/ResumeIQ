export function extractResumeTextFromFile(
  file: File,
  options?: { onProgress?: (percent: number) => void },
): Promise<{ text: string; fileName: string }>;

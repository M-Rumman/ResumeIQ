/**
 * Resume text extraction — routes PDF/DOCX to the correct parser.
 */

import { validateResumeFile, RESUME_FILE_TYPES } from './resumeFileValidation.js';

/**
 * Read a File as ArrayBuffer.
 * @param {File} file
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract resume text from an uploaded PDF or DOCX file.
 *
 * @param {File} file
 * @param {{ onProgress?: (percent: number) => void }} [options]
 * @returns {Promise<{ text: string, fileType: string, fileName: string }>}
 */
export async function extractResumeTextFromFile(file, options = {}) {
  const { onProgress } = options;

  const validation = validateResumeFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { fileType } = validation;
  onProgress?.(5);

  const arrayBuffer = await readFileAsArrayBuffer(file);
  onProgress?.(15);

  let text;

  if (fileType === RESUME_FILE_TYPES.PDF) {
    const { extractPdfText } = await import('./extractPdfText.js');
    text = await extractPdfText(arrayBuffer, (pagePercent) => {
      // Map page progress into 15–95% of overall bar
      const overall = 15 + Math.round(pagePercent * 0.8);
      onProgress?.(overall);
    });
  } else if (fileType === RESUME_FILE_TYPES.DOCX) {
    const { extractDocxText } = await import('./extractDocxText.js');
    text = await extractDocxText(arrayBuffer, onProgress);
  } else {
    throw new Error('Unsupported file type.');
  }

  onProgress?.(100);

  return {
    text,
    fileType,
    fileName: file.name,
  };
}

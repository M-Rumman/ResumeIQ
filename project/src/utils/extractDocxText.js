/**
 * DOCX text extraction using mammoth (works in browser and Node).
 */

import mammoth from 'mammoth';

/**
 * Extract plain text from a DOCX file.
 * @param {ArrayBuffer} arrayBuffer
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>}
 */
export async function extractDocxText(arrayBuffer, onProgress) {
  onProgress?.(10);

  const result = await mammoth.extractRawText({ arrayBuffer });

  onProgress?.(100);

  const text = (result.value || '').trim();

  if (!text) {
    throw new Error(
      'No readable text found in this document. Try a different file or paste your resume text.',
    );
  }

  if (result.messages?.length) {
    console.warn('[extractDocxText] mammoth messages:', result.messages);
  }

  return text;
}

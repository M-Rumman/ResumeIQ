/**
 * PDF text extraction using pdfjs-dist (browser-compatible).
 * pdf-parse is Node-only; PDF.js runs in the client with Vite.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerConfigured = false;

function ensurePdfWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    workerConfigured = true;
  }
}

/**
 * PDF.js returns positioned text fragments, not document lines. Rebuild the
 * reading order from their baselines so downstream section detection receives
 * headings, bullets, and paragraphs on separate lines.
 */
function reconstructPageText(items) {
  const fragments = items
    .filter((item) => item && typeof item.str === 'string' && item.str.trim())
    .map((item) => {
      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      const height = Math.max(1, Math.abs(Number(item.height || item.transform?.[3] || 10)));
      return {
        text: item.str.replace(/\s+/g, ' ').trim(),
        x,
        y,
        width: Math.abs(Number(item.width || 0)),
        height,
      };
    });

  if (!fragments.length) return '';

  // Adjacent PDF fragments on the same baseline can vary slightly because of
  // font metrics. Use a tolerance derived from the median text height.
  const heights = fragments.map((fragment) => fragment.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
  const baselineTolerance = Math.max(2, Math.min(5, medianHeight * 0.35));
  const lines = [];

  for (const fragment of [...fragments].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - fragment.y) <= baselineTolerance);
    if (line) {
      line.fragments.push(fragment);
      line.y = (line.y * (line.fragments.length - 1) + fragment.y) / line.fragments.length;
      line.height = Math.max(line.height, fragment.height);
    } else {
      lines.push({ y: fragment.y, height: fragment.height, fragments: [fragment] });
    }
  }

  const joinLine = (line) => {
    const fragmentsOnLine = [...line.fragments].sort((a, b) => a.x - b.x);
    let text = '';
    let previous = null;

    for (const fragment of fragmentsOnLine) {
      if (!previous) {
        text = fragment.text;
      } else {
        const gap = fragment.x - (previous.x + previous.width);
        const noSpace =
          gap <= Math.max(1, previous.height * 0.12) ||
          /^[,.;:!?%\])}]/.test(fragment.text) ||
          /[([{/]$/.test(text);
        text += `${noSpace ? '' : ' '}${fragment.text}`;
      }
      previous = fragment;
    }

    return text.replace(/\s+/g, ' ').trim();
  };

  const orderedLines = lines
    .map((line) => ({ ...line, text: joinLine(line) }))
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y || a.fragments[0].x - b.fragments[0].x);

  const output = [];
  for (let index = 0; index < orderedLines.length; index += 1) {
    const line = orderedLines[index];
    const previous = orderedLines[index - 1];
    if (previous) {
      const verticalGap = previous.y - line.y;
      const normalLineGap = Math.max(previous.height, line.height) * 1.45;
      // A visibly larger vertical gap normally marks a paragraph/section break.
      if (verticalGap > normalLineGap) output.push('');
    }
    output.push(line.text);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractPdfText(arrayBuffer, onProgress) {
  ensurePdfWorker();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  const allLinks = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = reconstructPageText(textContent.items);

    if (pageText) pageTexts.push(pageText);

    // Extract hyperlinks from page annotations
    try {
      const annotations = await page.getAnnotations();
      for (const annot of annotations) {
        if (
          annot &&
          (annot.subtype === 'Link' || annot.annotationType === 3) &&
          (annot.url || annot.unsafeUrl)
        ) {
          const url = annot.url || annot.unsafeUrl;
          const rect = annot.rect; // [xMin, yMin, xMax, yMax]
          if (rect && rect.length === 4) {
            const left = Math.min(rect[0], rect[2]);
            const right = Math.max(rect[0], rect[2]);
            const bottom = Math.min(rect[1], rect[3]);
            const top = Math.max(rect[1], rect[3]);

            const matchingItems = [];
            for (const item of textContent.items) {
              if (!item || typeof item.str !== 'string') continue;
              const tx = item.transform?.[4];
              const ty = item.transform?.[5];
              if (tx === undefined || ty === undefined) continue;

              const itemWidth = Math.abs(item.width || 0);
              const itemHeight = Math.abs(item.height || item.transform?.[3] || 10);

              const textLeft = tx;
              const textRight = tx + itemWidth;
              const textBottom = ty;
              const textTop = ty + itemHeight;

              const padding = 2;
              const overlapX = (textLeft - padding) < right && (textRight + padding) > left;
              const overlapY = (textBottom - padding) < top && (textTop + padding) > bottom;

              if (overlapX && overlapY) {
                matchingItems.push({ str: item.str, tx });
              }
            }

            // Sort matching text items by their x coordinate (left-to-right)
            matchingItems.sort((a, b) => a.tx - b.tx);
            const anchorText = matchingItems
              .map((item) => item.str)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();

            allLinks.push({
              anchorText: anchorText || url,
              url,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[extractPdfText] Failed to extract annotations for page ${pageNum}:`, err);
    }

    if (onProgress) {
      onProgress(Math.round((pageNum / pdf.numPages) * 100));
    }
  }

  // Deduplicate links by URL
  const seenUrls = new Set();
  const uniqueLinks = [];
  for (const link of allLinks) {
    if (!seenUrls.has(link.url)) {
      seenUrls.add(link.url);
      uniqueLinks.push(link);
    }
  }

  let fullText = pageTexts.join('\n\n').trim();

  if (uniqueLinks.length > 0) {
    const formattedLinks = uniqueLinks
      .map((link) => `${link.anchorText}\n→ ${link.url}`)
      .join('\n\n');
    fullText += `\n\nExtracted Links:\n${formattedLinks}`;
  }

  if (!fullText) {
    throw new Error(
      'No readable text found in this PDF. It may be scanned as images — paste your resume text instead.',
    );
  }

  return fullText;
}

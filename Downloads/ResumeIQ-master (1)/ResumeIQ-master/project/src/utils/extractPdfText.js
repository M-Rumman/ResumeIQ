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

export async function extractPdfText(arrayBuffer, onProgress) {
  ensurePdfWorker();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  const allLinks = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

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

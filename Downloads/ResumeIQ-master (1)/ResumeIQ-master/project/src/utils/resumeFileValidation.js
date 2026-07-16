/**
 * Resume file validation — shared rules for upload UI and extractors.
 */

export const RESUME_FILE_TYPES = {
  PDF: 'pdf',
  DOCX: 'docx',
};

/** Max upload size (5 MB). */
export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;

const EXTENSION_MAP = {
  pdf: RESUME_FILE_TYPES.PDF,
  docx: RESUME_FILE_TYPES.DOCX,
};

const MIME_MAP = {
  'application/pdf': RESUME_FILE_TYPES.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': RESUME_FILE_TYPES.DOCX,
};

/**
 * @param {string} fileName
 */
export function getExtension(fileName) {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

/**
 * Detect supported resume file type from name and MIME.
 * @param {File} file
 * @returns {string | null} RESUME_FILE_TYPES value or null
 */
export function detectResumeFileType(file) {
  const ext = getExtension(file.name);
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];

  if (file.type && MIME_MAP[file.type]) return MIME_MAP[file.type];

  return null;
}

/**
 * Validate file before extraction.
 * @param {File} file
 * @returns {{ valid: boolean, error: string | null, fileType: string | null }}
 */
export function validateResumeFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.', fileType: null };
  }

  if (file.size > MAX_RESUME_FILE_BYTES) {
    return {
      valid: false,
      error: 'File is too large. Maximum size is 5 MB.',
      fileType: null,
    };
  }

  const fileType = detectResumeFileType(file);

  if (!fileType) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload a PDF or DOCX resume.',
      fileType: null,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'The file is empty.', fileType: null };
  }

  return { valid: true, error: null, fileType };
}

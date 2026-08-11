import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCandidateProfile } from './_lib/analysis-engine/resumeExtraction.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as { resumeText?: string };
  const resumeText = (body.resumeText || '').trim();

  if (!resumeText) {
    return res.status(400).json({ error: 'Missing resumeText' });
  }

  try {
    const candidateProfile = extractCandidateProfile(resumeText);
    return res.status(200).json({ candidateProfile });
  } catch (error) {
    console.error('Error in preprocess-resume:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

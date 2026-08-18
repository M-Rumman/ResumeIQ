import assert from 'node:assert/strict';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';
import { parseJobDescription } from '../../api/_lib/analysis-engine/jdParser.js';
import { getDeterministicMatches, matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';

const resumeText = `
Experience
Data Scientist at TechCorp
- Managed data science projects and led the team.
- Presented to VP and C-suite stakeholders on project milestones.
- Managed a generic project with some leadership aspects.
- Ran extensive A/B tests and usability interviews for new features.
- Set up a participant panel and research repository for ops.
`;

const jdText = `
Requirements:
- Executive Presentations
- Data Science Partnership
- Mentoring
- Research Methods
- Research Operations
`;

async function testEvidenceMapping() {
  process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const prompt = body.messages?.[1]?.content || '';
    
    // JD Parser mock
    if (prompt.includes('Raw Job Description:')) {
      const mockLlmOutput = [
        { normalized_name: 'Executive Presentations', original_text: 'Executive Presentations', category: 'responsibility', priority: 'required' },
        { normalized_name: 'Data Science Partnership', original_text: 'Data Science Partnership', category: 'responsibility', priority: 'required' },
        { normalized_name: 'Mentoring', original_text: 'Mentoring', category: 'responsibility', priority: 'required' },
        { normalized_name: 'Research Methods', original_text: 'Research Methods', category: 'hard skill', priority: 'required' },
        { normalized_name: 'Research Operations', original_text: 'Research Operations', category: 'responsibility', priority: 'required' }
      ];
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(mockLlmOutput) } }] })
      } as any;
    }

    // Matcher LLM Mock - Simulate LLM picking generic/hallucinated IDs to force fallbacks
    if (prompt.includes('Requirements:') && prompt.includes('Candidate Facts')) {
      // Intentionally return an empty matches array to trigger fallback logic
      const mockMatcherOutput: any[] = [];
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ matches: mockMatcherOutput }) } }] })
      } as any;
    }

    return { ok: true, json: async () => ({}) } as any;
  };

  try {
    const job = await parseJobDescription(jdText);
    const candidate = await extractCandidateProfile(resumeText);
    
    const deterministic = getDeterministicMatches(job, candidate);
    const result = await matchRequirements(job, candidate, deterministic);
    
    const execPresMatch = result.matches.find(m => m.requirement.normalized_name === 'Executive Presentations');
    const dsPartnerMatch = result.matches.find(m => m.requirement.normalized_name === 'Data Science Partnership');
    const mentoringMatch = result.matches.find(m => m.requirement.normalized_name === 'Mentoring');
    const methodsMatch = result.matches.find(m => m.requirement.normalized_name === 'Research Methods');
    const opsMatch = result.matches.find(m => m.requirement.normalized_name === 'Research Operations');

    // Assert specific evidence mapping
    assert.ok(execPresMatch, 'Executive Presentations requirement not found');
    assert.match(execPresMatch.evidence[0].source_text, /Presented to VP and C-suite stakeholders/i, 'Failed to map Executive Presentations to correct bullet');

    assert.ok(dsPartnerMatch, 'Data Science Partnership requirement not found');
    assert.match(dsPartnerMatch.evidence[0].source_text, /Managed data science projects/i, 'Failed to map Data Science Partnership to correct bullet');

    assert.ok(methodsMatch, 'Research Methods requirement not found');
    assert.match(methodsMatch.evidence[0].source_text, /usability interviews/i, 'Failed to map Research Methods to correct bullet');

    assert.ok(opsMatch, 'Research Operations requirement not found');
    assert.match(opsMatch.evidence[0].source_text, /research repository/i, 'Failed to map Research Operations to correct bullet');

    // Assert unrelated requirement gets MISSING instead of generic bullet
    assert.ok(mentoringMatch, 'Mentoring requirement not found');
    assert.strictEqual(mentoringMatch.classification, 'MISSING', 'Mentoring should be MISSING due to threshold, not incorrectly mapped');

    console.log('PASS Evidence mapping tests');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testEvidenceMapping().catch(err => {
  console.error('FAIL Evidence mapping tests:', err);
  process.exit(1);
});

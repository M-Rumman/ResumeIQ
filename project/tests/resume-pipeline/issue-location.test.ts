import { getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import type { CandidateProfile, JobProfile, CandidateFact } from '../../api/_lib/analysis-engine/types.js';
import assert from 'node:assert';

function mockReq(text: string, category: 'location' = 'location', original?: string) {
  return {
    id: 'req1',
    normalized_name: text,
    category,
    original_text: original || text,
    importance: 'must_have' as const
  };
}

function mockFact(id: string, text: string, type: CandidateFact['type'] = 'experience', section = 'experience', employment_duration_years?: number): CandidateFact {
  return {
    id,
    type,
    normalizedName: text.substring(0, 20),
    rawText: text,
    sourceSection: section,
    evidence: text,
    employment_duration_years
  };
}

const defaultCandidateInfo = {
  name: 'Test',
  email: 'test@example.com',
  phone: '123',
  location: ''
};

async function runTests() {
  console.log('Running location matcher tests...');

  // A. Chicago university + unknown residence ≠ Chicago candidate location (Expect MISSING)
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL', 'location')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Springfield, IL' }, 
      rawStructure: {} as any, 
      facts: [
        mockFact('f1', 'B.A. in Communications, Northeastern Illinois University, 2020', 'education', 'education')
      ]
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'MISSING');
    console.log('✅ Test A passed');
  }

  // B. Chicago contact header → valid Chicago evidence
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL', 'location')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Chicago, IL' }, 
      rawStructure: {} as any, 
      facts: []
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test B passed');
  }

  // C. Current Chicago employer can be considered valid evidence
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL', 'location')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Unknown' }, 
      rawStructure: {} as any, 
      facts: [
        mockFact('f1', 'Acme Corp, Chicago, IL (Jan 2020 - Present)', 'experience', 'experience')
      ]
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    assert.strictEqual(matches[0].evidence[0]?.fact_id, 'f1');
    console.log('✅ Test C passed');
  }

  // D. Past Chicago employer should NOT be considered valid evidence (Expect MISSING)
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL', 'location')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Unknown' }, 
      rawStructure: {} as any, 
      facts: [
        mockFact('f1', 'Acme Corp, Chicago, IL (Jan 2015 - Jan 2018)', 'experience', 'experience') // past job
      ]
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'MISSING');
    console.log('✅ Test D passed');
  }

  // E. Explicit remote-only preference does not satisfy hybrid availability
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL (Hybrid)', 'location', 'Chicago, IL (Hybrid - 3 days onsite)')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Chicago, IL' }, 
      rawStructure: {} as any, 
      facts: [
        mockFact('f1', 'Looking for remote only roles', 'other', 'summary')
      ]
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test E passed');
  }

  // F. Explicit relocation statement satisfies location
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('Location: Chicago, IL', 'location')] };
    const candidate: CandidateProfile = { 
      contact: { ...defaultCandidateInfo, location: 'Austin, TX' }, 
      rawStructure: {} as any, 
      facts: [
        mockFact('f1', 'Willing to relocate to Chicago, IL', 'other', 'summary')
      ]
    };
    const matches = getDeterministicMatches(job, candidate).matches;
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test F passed');
  }

}

runTests().catch(console.error);

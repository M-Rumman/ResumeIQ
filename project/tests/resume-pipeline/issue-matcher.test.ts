import assert from 'node:assert';
import { getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobProfile, CandidateProfile, JobRequirement, CandidateFact } from '../../api/_lib/analysis-engine/types.js';

const mockReq = (name: string, minYears: number, category: JobRequirement['category'] = 'experience'): JobRequirement => ({
  id: 'req-1',
  category,
  normalized_name: name,
  original_text: name,
  source_section: 'Requirements',
  source_span: [0, 10],
  source_text: name,
  priority: 'required',
  requirement_type: category,
  confidence: 1.0,
  minimum_years: minYears
});

const mockFact = (id: string, text: string, type: CandidateFact['type'] = 'experience'): CandidateFact => ({
  id,
  type,
  normalizedName: text,
  rawText: text,
  sourceSection: type === 'experience' ? 'Experience' : 'Education',
  evidence: text
});

const runTests = async () => {
  console.log('Running deterministic duration matcher tests...');

  // A. 4.5 years vs 6+ required -> must not be EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'UX Researcher Jan 2020 - Jul 2024') // 4.5 years
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test A passed');
  }

  // B. 6+ years vs 6+ required -> EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'UX Researcher Jan 2018 - Jan 2024') // 6 years
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test B passed');
  }

  // C. 7 years vs 6+ required -> EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'UX Researcher Jan 2017 - Jan 2024') // 7 years
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test C passed');
  }

  // D. Ambiguous dates -> ANALYSIS_FAILED
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'UX Researcher at Google') // No dates
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'ANALYSIS_FAILED');
    console.log('✅ Test D passed');
  }

  // E. Internships/education do not inflate professional experience
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'Ph.D. UX Research Jan 2015 - Jan 2020', 'education'),
      mockFact('f2', 'UX Researcher Jan 2020 - Jan 2024') // 4 years
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH'); // Education not counted, so 4 years < 6 -> PARTIAL
    console.log('✅ Test E passed');
  }

  // F. Overlapping jobs are not double-counted
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'UX Researcher Jan 2020 - Jan 2024'), // 4 years
      mockFact('f2', 'UX Researcher Jun 2022 - Jan 2024') // 1.5 years overlapping
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH'); // Should be 4 years total, not 5.5
    console.log('✅ Test F passed');
  }
  
  // G. Irrelevant experience is not counted
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate: CandidateProfile = { contact: {} as any, rawStructure: {}, facts: [
      mockFact('f1', 'Cashier Jan 2010 - Jan 2020'), // 10 years irrelevant
      mockFact('f2', 'UX Researcher Jan 2020 - Jan 2022') // 2 years relevant
    ]};
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH'); // Only 2 years relevant
    console.log('✅ Test G passed');
  }
};

runTests().catch(console.error);

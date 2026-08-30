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

const mockCandidate = (facts: CandidateFact[]): CandidateProfile => ({
  contact: {} as any,
  rawStructure: {} as any,
  facts
});

const runTests = async () => {
  console.log('Running deterministic duration matcher tests...');

  // A. 4.5 years vs 6+ required -> must not be EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher Jan 2020 - Jul 2024') // 4.5 years
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test A passed');
  }

  // B. 6+ years vs 6+ required -> EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher Jan 2018 - Jan 2024') // 6 years
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test B passed');
  }

  // C. 7 years vs 6+ required -> EXACT_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher Jan 2017 - Jan 2024') // 7 years
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    console.log('✅ Test C passed');
  }

  // D. Ambiguous dates -> PARTIAL_MATCH (previously ANALYSIS_FAILED)
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher at Google') // No dates
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    assert.match(matches[0].explanation, /ambiguous or missing/i);
    console.log('✅ Test D passed');
  }

  // A2. Exactly 5 years vs 6+ required -> PARTIAL_MATCH
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher Jan 2018 - Jan 2023') // 5 years
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    assert.match(matches[0].explanation, /Approximately 5 years of relevant/i);
    console.log('✅ Test A2 passed');
  }

  // E. Internships/education do not inflate professional experience
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'Ph.D. UX Research Jan 2015 - Jan 2020', 'education'),
      mockFact('f2', 'UX Researcher Jan 2020 - Jan 2024') // 4 years
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test E passed');
  }

  // F. Overlapping jobs are not double-counted
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Researcher Jan 2020 - Jan 2024'), // 4 years
      mockFact('f2', 'UX Researcher Jun 2022 - Jan 2024') // 1.5 years overlapping
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test F passed');
  }
  
  // G. Irrelevant experience is not counted
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'Cashier Jan 2010 - Jan 2020'), // 10 years irrelevant
      mockFact('f2', 'UX Researcher Jan 2020 - Jan 2022') // 2 years relevant
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'PARTIAL_MATCH');
    console.log('✅ Test G passed');
  }

  // H. Pure lexical overlap must not yield UNDER_EXPRESSED
  {
    const req = mockReq('Advanced Machine Learning and AI', 0, 'hard skill');
    const job: JobProfile = { title: 'Data', requirements: [req] };
    const candidate = mockCandidate([
      mockFact('f1', 'Advanced Data Learning')
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    const match = matches.find(m => m.classification === 'UNDER_EXPRESSED');
    assert.strictEqual(match, undefined);
    console.log('✅ Test H passed');
  }

  // I. Internship + full-time experience correctly aggregates and calls out internship
  {
    const job: JobProfile = { title: 'UX', requirements: [mockReq('6+ years UX research experience', 6)] };
    const candidate = mockCandidate([
      mockFact('f1', 'UX Research Intern Jan 2017 - Jan 2018'), // 1 year internship
      mockFact('f2', 'UX Researcher Jan 2018 - Jan 2023') // 5 years full-time
    ]);
    const { matches } = getDeterministicMatches(job, candidate);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].classification, 'EXACT_MATCH');
    assert.match(matches[0].explanation, /Includes internship experience/i);
    console.log('✅ Test I passed');
  }
};

runTests().catch(console.error);

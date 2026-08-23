import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import { AiPipelineError } from '../../api/_lib/openrouter.js';
import analyzeResumeHandler from '../../api/analyze-resume.js';
import interviewPrepHandler from '../../api/interview-prep.ts';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';

// Setup environment variables for testing
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

// Helper to construct mock res
function makeMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.headers = {};
  res.jsonData = null;
  res.ended = false;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  res.setHeader = (name: string, value: string) => {
    res.headers[name] = value;
    return res;
  };
  res.end = () => {
    res.ended = true;
    return res;
  };
  return res;
}

// Variables to track mocked state
let mockDailyTriesUsed = 0;
let mockDailyLimit = 2;
let commitUsageCalledCount = 0;
let lastRpcFeatureType = '';
let insertRecordCalledCount = 0;
let deleteRecordCalledCount = 0;
let fetchMockBehavior = 'normal'; // 'normal', 'jd_empty', 'resume_empty', 'provider_error', 'malformed_json', 'scoring_error', 'commit_concurrency_error'

// Mock global fetch
// Helper to create valid mock fetch response objects that Supabase JS client parses correctly
function makeMockFetchResponse(status: number, data: any) {
  const jsonStr = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => jsonStr,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      }
    }
  } as any;
}

// Mock global fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: string | URL, options: any) => {
  const urlStr = typeof url === 'string' ? url : url.toString();
  
  let systemPrompt = '';
  try {
    const reqBody = options?.body ? JSON.parse(options.body) : {};
    const messages = reqBody.messages || [];
    systemPrompt = messages.find((m: any) => m.role === 'system')?.content || '';
    if (systemPrompt) {
      console.log('[MOCK FETCH]', urlStr, 'systemPrompt:', systemPrompt.slice(0, 50).replace(/\n/g, ' '));
    }
  } catch (e) {}

  // 1. Supabase Auth mock
  if (urlStr.includes('/auth/v1/user')) {
    return makeMockFetchResponse(200, { id: 'mock-user-id', email: 'user@example.com' });
  }

  // 2. Supabase DB RPC mock (complete_free_ai_usage)
  if (urlStr.includes('/rest/v1/rpc/complete_free_ai_usage')) {
    commitUsageCalledCount++;
    const body = JSON.parse(options.body || '{}');
    lastRpcFeatureType = body.p_feature_type;

    if (fetchMockBehavior === 'commit_concurrency_error') {
      // Concurrency scenario: second request fails to commit
      return makeMockFetchResponse(200, [{ allowed: false, used: mockDailyLimit, daily_limit: mockDailyLimit, reset_date: '2026-08-23' }]);
    }

    if (mockDailyTriesUsed >= mockDailyLimit) {
      return makeMockFetchResponse(200, [{ allowed: false, used: mockDailyTriesUsed, daily_limit: mockDailyLimit, reset_date: '2026-08-23' }]);
    }

    mockDailyTriesUsed++;
    return makeMockFetchResponse(200, [{ allowed: true, used: mockDailyTriesUsed, daily_limit: mockDailyLimit, reset_date: '2026-08-23' }]);
  }

  // 3. Supabase DB select profiles mock
  if (urlStr.includes('/rest/v1/profiles')) {
    if (options.method === 'GET') {
      return makeMockFetchResponse(200, {
        resume_analysis_count_today: mockDailyTriesUsed,
        interview_prep_count_today: mockDailyTriesUsed,
        last_usage_reset_date: '2026-08-23',
        plan: 'free',
        subscription_status: 'inactive',
        is_pro: false
      });
    }
    // Update profiles check (protect trigger bypass)
    return makeMockFetchResponse(200, {});
  }

  // 4. Supabase DB table insert mocks
  if (urlStr.includes('/rest/v1/resume_analysis') || urlStr.includes('/rest/v1/interview_prep')) {
    if (options.method === 'POST') {
      insertRecordCalledCount++;
      return makeMockFetchResponse(201, { id: 'mock-report-id' });
    } else if (options.method === 'DELETE') {
      deleteRecordCalledCount++;
      return makeMockFetchResponse(200, {});
    }
  }

  // 5. Supabase DB table usage_tracking mock
  if (urlStr.includes('/rest/v1/usage_tracking')) {
    return makeMockFetchResponse(201, {});
  }

  // 6. LLM API call mocks
  if (urlStr.includes('openrouter.ai/api/v1/chat/completions') || urlStr.includes('generativelanguage.googleapis.com')) {
    if (fetchMockBehavior === 'provider_error') {
      return makeMockFetchResponse(503, { error: 'Service Unavailable' });
    }

    if (fetchMockBehavior === 'malformed_json') {
      return makeMockFetchResponse(200, {
        choices: [{ message: { content: 'this is not valid json {{{' } }]
      });
    }

    // Determine what LLM call is being made based on prompts
    const reqBody = JSON.parse(options.body || '{}');
    const messages = reqBody.messages || [];
    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content || '';

    // A. JD Parser Prompt
    if (systemPrompt.includes('Job Description (JD) analyzer')) {
      if (fetchMockBehavior === 'jd_empty') {
        return makeMockFetchResponse(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Test Software Engineer',
                requirements: [] // Empty requirements list!
              })
            }
          }]
        });
      }

      const requirements = [
        { id: 'req-1', normalized_name: 'TypeScript', category: 'skills', priority: 'required', original_text: 'TypeScript' }
      ];
      if (fetchMockBehavior === 'scoring_error') {
        requirements.push(
          { id: 'req-2', normalized_name: 'Rust', category: 'skills', priority: 'required', original_text: 'Rust' },
          { id: 'req-3', normalized_name: 'Rust', category: 'skills', priority: 'required', original_text: 'Rust' }
        );
      }

      return makeMockFetchResponse(200, {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Senior Software Engineer',
              requirements
            })
          }
        }]
      });
    }

    // B. Matcher Prompt
    if (systemPrompt.includes('recruiter and evidence evaluator')) {
      if (fetchMockBehavior === 'scoring_error') {
        return makeMockFetchResponse(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                matches: [
                  {
                    requirementId: 'req-2',
                    classification: 'MISSING',
                    match_tier: 'tier_3_semantic',
                    evidence: [{ fact_id: 'fact-1', evidence_type: 'skills', source_text: 'Wrote TS code' }],
                    explanation: 'Rust is missing.'
                  }
                ]
              })
            }
          }]
        });
      }

      return makeMockFetchResponse(200, {
        choices: [{
          message: {
            content: JSON.stringify({
              matches: [
                {
                  requirementId: 'req-1',
                  classification: 'EXACT_MATCH',
                  match_tier: 'strong',
                  evidence: [{ fact_id: 'fact-1', rawText: 'Wrote TS code', sourceSection: 'skills' }],
                  explanation: 'Match found.'
                }
              ]
            })
          }
        }]
      });
    }

    // C. Bullet Rewriter Prompt
    if (systemPrompt.includes('expert resume editor')) {
      return makeMockFetchResponse(200, {
        choices: [{
          message: {
            content: JSON.stringify({
              improvedBulletPoints: [
                {
                  before: 'wrote code',
                  after: 'Engineered TypeScript robust features, increasing efficiency by 20%',
                  improvementScore: 15,
                  whyItIsWeak: 'Lacks metrics',
                  whyThisIsStronger: 'Includes metrics and technologies',
                  beforeScore: 50,
                  afterScore: 65,
                  groundingConfidence: 'High'
                }
              ]
            })
          }
        }]
      });
    }

    // D. Interview Prep Prompt
    if (systemPrompt.includes('senior interview coach')) {
      return makeMockFetchResponse(200, {
        choices: [{
          message: {
            content: JSON.stringify({
              hrQuestions: [
                { question: 'Tell me about yourself.', idealAnswer: 'I am a software engineer.', tip: 'Be concise.' }
              ],
              technicalQuestions: [
                { question: 'Explain event loop in Node.js', idealAnswer: 'It handles async operations.', tip: 'Mention microtasks.' }
              ],
              behavioralQuestions: [
                { question: 'Describe a challenge you faced.', idealAnswer: 'Debugging a production issue.', tip: 'Focus on collaboration.' }
              ],
              preparationRoadmap: ['1. Read architecture docs', '2. Build a proxy']
            })
          }
        }]
      });
    }
  }

  // Fallback
  return makeMockFetchResponse(200, {});
};

// Reset tracker variables before each test
function resetTracker() {
  commitUsageCalledCount = 0;
  insertRecordCalledCount = 0;
  deleteRecordCalledCount = 0;
  lastRpcFeatureType = '';
  fetchMockBehavior = 'normal';
}

async function runTests() {
  console.log('Starting Daily Usage / Tries System Test Suite...');

  // ==========================================
  // TEST 1 — Successful analysis
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;
  mockDailyLimit = 2;

  let req: any = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  let res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 200, 'TEST 1: Handler should return 200 OK');
  assert.ok(res.jsonData && typeof res.jsonData.atsScore === 'number', 'TEST 1: Should return valid analysis results');
  assert.equal(mockDailyTriesUsed, 1, 'TEST 1: Usage should be incremented to 1');
  assert.equal(commitUsageCalledCount, 1, 'TEST 1: complete_free_ai_usage RPC should be called once');
  assert.equal(insertRecordCalledCount, 1, 'TEST 1: Database persistence insert should be called once');
  console.log('✅ TEST 1 Passed: Successful analysis consumes exactly 1 try.');

  // ==========================================
  // TEST 2 — JD parsing failure
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;
  fetchMockBehavior = 'jd_empty'; // JD parser yields 0 requirements

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Some invalid target job posting.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 502, 'TEST 2: Handler should return 502 Bad Gateway / Pipeline Error');
  assert.equal(mockDailyTriesUsed, 0, 'TEST 2: Usage should remain 0');
  assert.equal(commitUsageCalledCount, 0, 'TEST 2: RPC should not be called');
  assert.equal(insertRecordCalledCount, 0, 'TEST 2: Record should not be inserted');
  console.log('✅ TEST 2 Passed: JD parsing failure does not consume a try.');

  // ==========================================
  // TEST 3 — Resume parsing failure
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Short text', // too short, causes validation failure before pipeline
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 400, 'TEST 3: Handler should return 400 Bad Request');
  assert.equal(mockDailyTriesUsed, 0, 'TEST 3: Usage should remain 0');
  assert.equal(commitUsageCalledCount, 0, 'TEST 3: RPC should not be called');
  console.log('✅ TEST 3 Passed: Resume validation failure does not consume a try.');

  // ==========================================
  // TEST 4 — LLM/provider failure
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;
  fetchMockBehavior = 'provider_error'; // AI provider returns 503

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 502, 'TEST 4: Handler should return 502 Gateway Error');
  assert.equal(mockDailyTriesUsed, 0, 'TEST 4: Usage should remain 0');
  assert.equal(commitUsageCalledCount, 0, 'TEST 4: RPC should not be called');
  console.log('✅ TEST 4 Passed: AI provider failure does not consume a try.');

  // ==========================================
  // TEST 5 — Malformed AI output
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;
  fetchMockBehavior = 'malformed_json'; // AI provider returns unparseable JSON

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 502, 'TEST 5: Handler should return 502 Gateway Error (Malformed output)');
  assert.equal(mockDailyTriesUsed, 0, 'TEST 5: Usage should remain 0');
  assert.equal(commitUsageCalledCount, 0, 'TEST 5: RPC should not be called');
  console.log('✅ TEST 5 Passed: Malformed AI output does not consume a try.');

  // ==========================================
  // TEST 6 — Evaluator/scoring failure
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;
  fetchMockBehavior = 'scoring_error'; // Match contains invalid statuses, throws inside evaluator

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer and Rust developer.',
      candidateProfile: {
        contact: { name: 'Amina Khan', email: 'user@example.com' },
        rawStructure: { skills: ['TypeScript'] },
        facts: [
          {
            id: 'fact-1',
            type: 'skills',
            rawText: 'Wrote TS code',
            evidence: 'Wrote TS code',
            sourceSection: 'skills'
          }
        ]
      }
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 502, 'TEST 6: Handler should return 502 (Evaluator error)');
  assert.equal(mockDailyTriesUsed, 0, 'TEST 6: Usage should remain 0');
  assert.equal(commitUsageCalledCount, 0, 'TEST 6: RPC should not be called');
  console.log('✅ TEST 6 Passed: Evaluator/scoring failure does not consume a try.');

  // ==========================================
  // TEST 7 — Successful second analysis
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 1; // Already used 1 try

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 200, 'TEST 7: Handler should return 200 OK');
  assert.equal(mockDailyTriesUsed, 2, 'TEST 7: Usage should be incremented to 2');
  assert.equal(commitUsageCalledCount, 1, 'TEST 7: RPC should be called');
  console.log('✅ TEST 7 Passed: Successful second analysis consumes the second try (tries remaining = 0).');

  // ==========================================
  // TEST 8 — No free tries remaining
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 2; // Tries limit reached

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 429, 'TEST 8: Handler should return 429 Rate Limited / Quota Exceeded');
  assert.equal(mockDailyTriesUsed, 2, 'TEST 8: Usage should remain at 2');
  assert.equal(commitUsageCalledCount, 0, 'TEST 8: Commit usage RPC should not be called');
  console.log('✅ TEST 8 Passed: No tries remaining blocks request at preflight stage.');

  // ==========================================
  // TEST 9 — Concurrent requests
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 1; // 1 try remaining
  fetchMockBehavior = 'commit_concurrency_error'; // Mock database returning allowed=false during commit

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      resumeText: 'Amina Khan\nLahore, Pakistan\nEducation\nBachelor of Science in Computer Science\nSkills\nTypeScript\nReact\nExperience\nSoftware Developer | Acme\nWrote TS code.',
      jobDescription: 'Required skill: TypeScript developer.'
    }
  };
  res = makeMockRes();

  await analyzeResumeHandler(req, res);

  assert.equal(res.statusCode, 429, 'TEST 9: Handler should return 429 quota reached');
  assert.equal(mockDailyTriesUsed, 1, 'TEST 9: Usage counter must remain at 1');
  assert.equal(commitUsageCalledCount, 1, 'TEST 9: Commit rpc was called');
  assert.equal(deleteRecordCalledCount, 1, 'TEST 9: Temporary record must be rolled back/deleted');
  console.log('✅ TEST 9 Passed: Concurrent commit overflow safely rejects and rolls back.');

  // ==========================================
  // TEST 10 — Interview Prep Successful prep session
  // ==========================================
  resetTracker();
  mockDailyTriesUsed = 0;

  req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock-token' },
    body: {
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      skills: 'TypeScript, Node.js'
    }
  };
  res = makeMockRes();

  await interviewPrepHandler(req, res);

  assert.equal(res.statusCode, 200, 'TEST 10: Interview Prep should return 200 OK');
  assert.ok(res.jsonData && Array.isArray(res.jsonData.hrQuestions), 'TEST 10: Should return valid interview questions');
  assert.equal(mockDailyTriesUsed, 1, 'TEST 10: Usage should be incremented');
  assert.equal(commitUsageCalledCount, 1, 'TEST 10: Usage commit RPC should be called once');
  console.log('✅ TEST 10 Passed: Successful interview prep session consumes exactly 1 try.');

  // Restore original fetch
  globalThis.fetch = originalFetch;
  console.log('\nAll 10 daily usage test cases passed successfully!');
}

runTests().catch(err => {
  globalThis.fetch = originalFetch;
  console.error('Test suite failed:', err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';

const resumeText = `Priya Chandran
Chicago, IL

Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.

Experience:

2018–2019 Associate UX Researcher
2019–2021 UX Researcher
2021–Present Senior UX Researcher

Important evidence:

- mixed-methods
- generative research
- evaluative research
- longitudinal diary studies
- 5,000-person participant panel
- centralized research repository
- 34% adoption increase
- 50% recruitment reduction
- mentored 3 junior researchers
- 100+ usability tests/interviews
- clickstream analytics
- data science partnership
- surveys
- NPS
- CSAT
- 10,000+ customers
- VP/C-suite presentations
- product strategy
- B.A. Psychology
- M.S. HCI
- presented research to C-suite`; // Added "presented research to C-suite" for the storytelling test

const jdText = `The JD includes:

- 6+ years UX research
- fintech/banking
- mixed-methods
- generative research
- evaluative research
- longitudinal research
- interviews
- usability testing
- surveys
- diary studies
- actionable insights
- mentoring
- research operations
- research repositories
- participant panels
- data science partnership
- behavioral analytics
- senior leadership
- product strategy
- Bachelor's Psychology/HCI/Cognitive Science
- Master's preferred
- Python
- storytelling`; // Added storytelling for missing vs under-expressed test

type TestCase = { name: string; run: () => Promise<void> | void };

const tests: TestCase[] = [
  {
    name: 'complete Resume <-> JD analysis pipeline regression',
    run: async () => {
      // Setup mock API key so resolveOpenRouterApiKey doesn't throw
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      // Mock fetch to intercept LLM calls made by the matcher
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const prompt = body.messages?.[1]?.content || '';
        
        console.log('MOCK FETCH CALLED WITH PROMPT:', prompt.substring(0, 100));
        
        let classification = 'MISSING';
        let supportingFactId = null;
        
        const mockLlmOutput = [
          { normalized_name: '6+ years UX research', original_text: '6+ years UX research', category: 'experience', priority: 'required', minimum_years: 6 },
          { normalized_name: 'fintech/banking', original_text: 'fintech/banking', category: 'domain', priority: 'required' },
          { normalized_name: 'mixed-methods', original_text: 'mixed-methods', category: 'hard skill', priority: 'required' },
          { normalized_name: 'generative research', original_text: 'generative research', category: 'hard skill', priority: 'required' },
          { normalized_name: 'evaluative research', original_text: 'evaluative research', category: 'hard skill', priority: 'required' },
          { normalized_name: 'longitudinal research', original_text: 'longitudinal research', category: 'methodology', priority: 'required' },
          { normalized_name: 'interviews', original_text: 'interviews', category: 'methodology', priority: 'required' },
          { normalized_name: 'usability testing', original_text: 'usability testing', category: 'methodology', priority: 'required' },
          { normalized_name: 'surveys', original_text: 'surveys', category: 'methodology', priority: 'required' },
          { normalized_name: 'diary studies', original_text: 'diary studies', category: 'methodology', priority: 'required' },
          { normalized_name: 'actionable insights', original_text: 'actionable insights', category: 'responsibility', priority: 'required' },
          { normalized_name: 'mentoring', original_text: 'mentoring', category: 'responsibility', priority: 'required' },
          { normalized_name: 'research operations', original_text: 'research operations', category: 'responsibility', priority: 'required' },
          { normalized_name: 'research repositories', original_text: 'research repositories', category: 'tool', priority: 'required' },
          { normalized_name: 'participant panels', original_text: 'participant panels', category: 'tool', priority: 'required' },
          { normalized_name: 'data science partnership', original_text: 'data science partnership', category: 'responsibility', priority: 'required' },
          { normalized_name: 'behavioral analytics', original_text: 'behavioral analytics', category: 'hard skill', priority: 'required' },
          { normalized_name: 'senior leadership', original_text: 'senior leadership', category: 'soft skill', priority: 'required' },
          { normalized_name: 'product strategy', original_text: 'product strategy', category: 'responsibility', priority: 'required' },
          { normalized_name: 'Bachelor\'s Psychology/HCI/Cognitive Science', original_text: 'Bachelor\'s Psychology/HCI/Cognitive Science', category: 'education', degree_level: 'bachelor', fields: ['Psychology', 'HCI'], priority: 'required' },
          { normalized_name: 'Master\'s preferred', original_text: 'Master\'s preferred', category: 'education', degree_level: 'master', priority: 'preferred' },
          { normalized_name: 'Python', original_text: 'Python', category: 'hard skill', priority: 'required' },
          { normalized_name: 'storytelling', original_text: 'storytelling', category: 'soft skill', priority: 'required' },
          { normalized_name: 'Git', original_text: 'Git', category: 'tool', priority: 'required' }, // HALLUCINATED! Not in JD.
          { normalized_name: 'ROS', original_text: 'ROS', category: 'tool', priority: 'required' }, // HALLUCINATED! Not in JD.
        ];

        if (prompt.includes('Raw Job Description:')) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ title: 'Senior UX Researcher', company: 'Acme', requirements: mockLlmOutput }) } }]
            })
          } as any;
        }
        // Matcher mock is batched, so it should process ALL unmatched requirements
        const matches: any[] = [];
        const lines = prompt.split('\n');

        // Helper to find ID of a fact containing a string
        const findFactId = (textStr: string) => {
          const m = prompt.match(new RegExp(`\\[ID:\\s*([^\\]]+)\\][^\\[]*\\[Section:[^\\]]*\\][^\n]*${textStr}`, 'i'));
          return m ? m[1] : null;
        };

        for (const line of lines) {
          if (line.startsWith('[ID:')) {
            const reqIdMatch = line.match(/\[ID:\s*([^\]]+)\]\s*Name:\s*(.+?)\s*\(/);
            if (reqIdMatch) {
              const reqId = reqIdMatch[1];
              const reqName = reqIdMatch[2];
              let classification = 'MISSING';
              let supportingFactId = null;

              if (reqName.includes('behavioral analytics')) {
                classification = 'STRONG_SEMANTIC_MATCH';
                supportingFactId = findFactId('clickstream analytics');
              } else if (reqName.includes('senior leadership')) {
                classification = 'STRONG_SEMANTIC_MATCH';
                supportingFactId = findFactId('VP/C-suite');
              } else if (reqName.includes('product strategy')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('product strategy');
              } else if (reqName.includes('mentoring')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('mentored 3 junior researchers');
              } else if (reqName.includes('data science partnership')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('data science partnership');
              } else if (reqName.includes('Bachelor')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('B.A. Psychology');
              } else if (reqName.includes('storytelling')) {
                classification = 'UNDER_EXPRESSED';
                const m = prompt.match(/\[ID:\s*([^\]]+)\][^\[]*\[Section:[^\]]*\]\s*presented research/i);
                supportingFactId = m ? m[1] : null;
              } else if (reqName.includes('participant panels')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('participant panel');
              } else if (reqName.includes('research repositories')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('research repository');
              } else if (reqName.includes('longitudinal research')) {
                classification = 'STRONG_SEMANTIC_MATCH';
                supportingFactId = findFactId('longitudinal diary studies');
              } else if (reqName.includes('diary studies')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('longitudinal diary studies');
              } else if (reqName.includes('fintech/banking')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('fintech and consumer banking');
              } else if (reqName.includes('mixed-methods')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('mixed-methods');
              } else if (reqName.includes('generative research')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('generative research');
              } else if (reqName.includes('evaluative research')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('evaluative research');
              } else if (reqName.includes('interviews')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('usability tests/interviews');
              } else if (reqName.includes('usability testing')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('usability tests/interviews');
              } else if (reqName.includes('surveys')) {
                classification = 'EXACT_MATCH';
                supportingFactId = findFactId('surveys');
              } else if (reqName.includes('actionable insights')) {
                classification = 'STRONG_SEMANTIC_MATCH';
                supportingFactId = findFactId('product strategy');
              } else if (reqName.includes('research operations')) {
                classification = 'STRONG_SEMANTIC_MATCH';
                supportingFactId = findFactId('centralized research repository');
              } else if (reqName.includes('6+ years')) {
                classification = 'EXACT_MATCH';
                const m = prompt.match(/\[ID:\s*([^\]]+)\][^\[]*\[Section:[^\]]*\]\s*Senior UX Researcher with 7 years/i);
                supportingFactId = m ? m[1] : null;
              }

              matches.push({
                requirementId: reqId,
                classification,
                supportingFactId,
                explanation: 'Mocked response'
              });
            }
          }
        }

        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ matches }) } }]
          })
        } as any;

      };

      try {
        const engineResult = await runAnalysisPipeline({ resumeText, jobDescriptionText: jdText, includePremium: true });
        if (engineResult.tier !== 'premium') throw new Error('Expected premium tier');
        
        const finalReport = engineResult.legacyReport;

      // Assertionsrtions

      // 1 & 2 & HALLUCINATION PREVENTION: Git and ROS MUST NOT appear as job requirements.
      const hasGit = finalReport.requirementBreakdown.some(r => r.requirement.normalized_name === 'Git');
      assert.equal(hasGit, false, 'Git should be stripped out as it is hallucinated');
      const hasRos = finalReport.requirementBreakdown.some(r => r.requirement.normalized_name === 'ROS');
      assert.equal(hasRos, false, 'ROS should be stripped out as it is hallucinated');

      console.log('All requirements in breakdown:', finalReport.requirementBreakdown.map(r => r.requirement.normalized_name));
      // 3 & EDUCATION EQUIVALENCE: Bachelor's Psychology MUST be recognized as a strong/exact match.
      const bachelorsReq = finalReport.requirementBreakdown.find(m => m.requirement.degree_level === 'bachelor');
      console.log('Bachelor requirement classification:', bachelorsReq?.classification);
      console.log('Bachelor requirement evidence:', bachelorsReq?.evidence);
      assert.ok(bachelorsReq, 'Bachelor requirement should exist');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(bachelorsReq.classification), 'Bachelor should be a strong/exact match');

      // 4 & EXPERIENCE DURATION: 6+ years MUST be recognized as satisfied.
      const yearsReq = finalReport.requirementBreakdown.find(m => m.requirement.minimum_years === 6);
      assert.ok(yearsReq, '6+ years requirement should exist');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH', 'PARTIAL_MATCH'].includes(yearsReq.classification), '6+ years should be satisfied'); // Our engine gives Exact match usually.
      assert.ok(yearsReq.evidence.length > 0, 'Should have evidence for 6+ years');

      // 5. Participant panel MUST be recognized as direct evidence.
      const panelReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'participant panels');
      assert.ok(panelReq, 'participant panels requirement should exist');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(panelReq.classification));

      // 6. Research repository MUST be recognized as direct evidence.
      const repoReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'research repositories');
      assert.ok(repoReq, 'research repositories requirement should exist');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(repoReq.classification));

      // 7. Longitudinal research MUST be recognized.
      const longReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'longitudinal research');
      console.log('Longitudinal research classification:', longReq?.classification);
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(longReq!.classification));

      // 8. Diary studies MUST be recognized.
      const diaryReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'diary studies');
      console.log('Diary studies classification:', diaryReq?.classification);
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(diaryReq!.classification));

      // 9. Mentoring MUST be recognized.
      const mentoringReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'mentoring');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(mentoringReq!.classification));

      // 10. Data science partnership MUST be recognized.
      const dataReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'data science partnership');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(dataReq!.classification));

      // 11 & SEMANTIC MATCHING: Behavioral analytics <-> clickstream analytics must receive a semantic match.
      const analyticsReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'behavioral analytics');
      assert.ok(analyticsReq, 'behavioral analytics requirement should exist');
      assert.equal(analyticsReq.classification, 'STRONG_SEMANTIC_MATCH', 'Behavioral analytics should be a semantic match');

      // 12. Senior leadership must recognize VP/C-suite evidence.
      const leadershipReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'senior leadership');
      assert.ok(leadershipReq, 'senior leadership requirement should exist');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(leadershipReq.classification));

      // 13. Product strategy must recognize the explicit evidence.
      const strategyReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'product strategy');
      assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(strategyReq!.classification));

      // 14 & MISSING VS UNDER-EXPRESSED: Storytelling may be under-explicit/related, but must not automatically become a hard Missing requirement.
      const storytellingReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'storytelling');
      assert.ok(storytellingReq, 'storytelling requirement should exist');
      assert.notEqual(storytellingReq.classification, 'MISSING', 'Storytelling should not be strictly MISSING');
      assert.ok(['UNDER_EXPRESSED', 'RELATED_MATCH'].includes(storytellingReq.classification), 'Storytelling should be under-expressed or related');

      // 15 & SECTION DETECTION: Projects MUST NOT be detected as an explicit section because there is no Projects heading.
      const hasProjects = finalReport.detectedSections.some(s => s.toLowerCase() === 'projects');
      assert.equal(hasProjects, false, 'Projects section should not be explicitly detected');

      // 16. Interview probability MUST NOT be generated.
      assert.equal((finalReport.hiringManagerAssessment as any).estimatedInterviewProbability, undefined, 'Interview probability must not exist');

      // 17 & EVIDENCE PRIORITY: Experience evidence must be prioritized over Skills evidence when stronger evidence exists.
      // E.g., mentoring is an experience ("mentored 3 junior researchers").
      // The `sourceSection` of the top evidence should be 'experience' or 'inferred / not explicitly sectioned' (since it was just an unstructured list, wait, it was under "Experience:").
      // Actually, since the resume has "Experience:", it's an experience block. Let's verify top evidence.
      const mentoringEvidence = mentoringReq!.evidence[0];
      assert.equal(mentoringEvidence.source_section, 'experience');

      // 18. Final classification must reflect that this is a very strong candidate for the supplied JD.
      console.log('Overall Decision:', finalReport.hiringManagerAssessment.overallDecision);
      console.log('Match Score:', finalReport.matchScore);
      assert.ok(['Excellent Match', 'Strong Match', 'Good Match'].includes(finalReport.hiringManagerAssessment.overallDecision), 'Candidate should be a strong/good match');

      // UNSUPPORTED SKILL: Python is Missing because it actually exists in the JD, but not in the resume.
      const pythonReq = finalReport.requirementBreakdown.find(m => m.requirement.normalized_name === 'Python');
      assert.equal(pythonReq?.classification, 'MISSING', 'Python should be missing from the resume');
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'LLM matcher parses valid UUIDs and matches correctly',
    run: async () => {
      const resumeText2 = `A Senior UX Researcher with 7 years of experience.
Experience includes:
- Senior UX Researcher
- UX Researcher
- Associate UX Researcher
- 100+ usability tests and interviews
- qualitative and quantitative research
- presented findings to VP and C-suite stakeholders
- influenced product strategy
- worked across design and product teams
- partnered with data science
- Dovetail
- UserTesting
- Qualtrics
- B.A. in Psychology`;

      const jdText2 = `Requirements:
- 3+ years UX research experience
- usability testing, interviews, surveys, qualitative research
- communication and presentation
- actionable product recommendations
- cross-functional product teams
- UserTesting, Qualtrics, Dovetail or similar
- Bachelor's degree in UX, Psychology, HCI or related field`;

      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const prompt = body.messages?.[1]?.content || '';
        
        if (prompt.includes('Raw Job Description:')) {
          const mockLlmOutput = [
            { normalized_name: '3+ years UX research experience', original_text: '3+ years UX research experience', category: 'experience', priority: 'required', minimum_years: 3 },
            { normalized_name: 'usability testing', original_text: 'usability testing, interviews, surveys, qualitative research', category: 'methodology', priority: 'required' },
            { normalized_name: 'communication', original_text: 'communication and presentation', category: 'soft skill', priority: 'required' },
            { normalized_name: 'actionable product recommendations', original_text: 'actionable product recommendations', category: 'responsibility', priority: 'required' },
            { normalized_name: 'cross-functional product teams', original_text: 'cross-functional product teams', category: 'responsibility', priority: 'required' },
            { normalized_name: 'UserTesting', original_text: 'UserTesting, Qualtrics, Dovetail or similar', category: 'tool', priority: 'required' },
            { normalized_name: 'Bachelor\'s in Psychology', original_text: 'Bachelor\'s degree in UX, Psychology, HCI or related field', category: 'education', degree_level: 'bachelor', fields: ['UX', 'Psychology', 'HCI'], priority: 'required' }
          ];
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ title: 'UX Researcher', requirements: mockLlmOutput }) } }]
            })
          } as any;
        }

        if (prompt.includes('Candidate Facts')) {
          const getFactId = (str: string) => {
            const m = prompt.match(new RegExp(`\\[ID:\\s*([^\\]]+)\\][^\\[]*\\[Section:[^\\]]*\\][^\n]*${str}`, 'i'));
            return m ? m[1] : null;
          };

          const matches = [];
          const lines = prompt.split('\n');
          for (const line of lines) {
            if (line.startsWith('[ID:')) {
              const reqIdMatch = line.match(/\[ID:\s*([^\]]+)\]\s*Name:\s*(.+?)\s*\(/);
              if (reqIdMatch) {
                const reqId = reqIdMatch[1];
                const name = reqIdMatch[2];
                let classification = 'MISSING';
                let factId = null;

                if (name.includes('3+ years')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('7 years');
                } else if (name.includes('usability')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('100\\+ usability');
                } else if (name.includes('communication')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('VP and C-suite');
                } else if (name.includes('actionable')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('product strategy');
                } else if (name.includes('cross-functional')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('design and product teams');
                } else if (name.includes('UserTesting')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('Dovetail');
                } else if (name.includes('Bachelor')) {
                  classification = 'STRONG_SEMANTIC_MATCH';
                  factId = getFactId('Psychology');
                }

                // Intentionally mock the LLM hallucinating the dummy placeholders if we were to test that it handles literal UUIDs or truncated UUIDs
                // But since we want to test if it processes valid IDs correctly now, we pass them.
                matches.push({
                  requirementId: reqId, // Correctly passing the requirement ID
                  classification,
                  supportingFactId: factId, // Correctly passing the fact ID
                  explanation: 'Mocked match'
                });
              }
            }
          }

          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ matches }) } }]
            })
          } as any;
        }

        return { ok: true, json: async () => ({}) } as any;
      };

      try {
        const engineResult = await runAnalysisPipeline({ resumeText: resumeText2, jobDescriptionText: jdText2, includePremium: true });
        if (engineResult.tier !== 'premium') throw new Error('Expected premium tier');
        
        const finalReport = engineResult.legacyReport;

        // Verify that matches are NOT all MISSING
        const allMissing = finalReport.requirementBreakdown.every(r => r.classification === 'MISSING');
        assert.equal(allMissing, false, 'Matcher should not mark all requirements as MISSING');

        // Check a specific requirement match
        const yearsReq = finalReport.requirementBreakdown.find(r => r.requirement.normalized_name.includes('3+ years'));
        assert.ok(yearsReq, 'Requirement should exist');
        assert.ok(['EXACT_MATCH', 'STRONG_SEMANTIC_MATCH'].includes(yearsReq.classification), 'Should match 3+ years experience');
        
        // Assert that the evidence IDs resolved correctly
        assert.ok(yearsReq.evidence.length > 0, 'Should have valid evidence for 3+ years experience');
        assert.ok(yearsReq.evidence[0].source_text.includes('7 years'), 'Evidence should cite 7 years');

      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test.run();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (e) {
      console.error(`❌ ${test.name}`);
      console.error(e);
      failed++;
    }
  }
  console.log(`\nTests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();

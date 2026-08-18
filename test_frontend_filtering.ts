import { runAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';
import { extractCandidateProfile } from './api/_lib/analysis-engine/resumeExtraction.js';

const priyaResume = `
Priya Chandran
Chicago, IL | priya.c@example.com | (312) 555-0192

SUMMARY
Senior UX Researcher with 7 years of experience specializing in qualitative and quantitative research methods. Proven track record of turning complex user behaviors into actionable product insights. Strong background in building research operations from the ground up and mentoring junior researchers.

EXPERIENCE
Brightledger Bank, 2021—Present
Senior UX Researcher
- Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard.
- Helped with UX research and did some testing.

`;

const northlightJD = `
Senior UX Researcher — Northlight Financial
Location: Chicago, IL (Hybrid — 3 days onsite)

We're looking for a Senior UX Researcher to lead mixed-methods research that shapes the future of our institutional trading platform. You'll partner closely with product, design, and data science teams to deliver insights that drive business impact.

Requirements:
- Bachelor's degree in Psychology, HCI, Cognitive Science, or related field (Master's preferred)
- 5+ years of applied UX research experience in a product environment
`;

// Mock global fetch to return deterministic results
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const prompt = body.messages[body.messages.length - 1].content;
  
  if (prompt.includes('expert Job Description (JD) analyzer') || prompt.includes('Raw Job Description:')) {
    // Return JD Parse
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          title: 'Senior UX Researcher',
          company: 'Northlight Financial',
          requirements: [
            {
              id: 'req_1',
              category: 'education',
              normalized_name: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field',
              priority: 'required',
              requirement_type: 'education',
              confidence: 0.9,
              original_text: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field (Master\'s preferred)',
              source_section: 'Requirements',
              source_span: [0, 50],
              source_text: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field (Master\'s preferred)'
            }
          ]
        }) } }]
      })
    };
  }
  
  if (prompt.includes('expert technical recruiter and evidence evaluator') || prompt.includes('Candidate Facts')) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ matches: [] }) } }]
      })
    };
  }

  if (prompt.includes('expert resume editor') || prompt.includes('weakBullets')) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          weakBullets: ["Helped with UX research and did some testing.", "Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard."], 
          improvedBulletPoints: [
            {
                before: "Helped with UX research and did some testing.",
                after: "Supported UX research and executed testing.",
                whyItIsWeak: "Weak verbs",
                whatInformationIsMissing: "None",
                whyThisIsStronger: "Stronger verbs",
                inferenceType: "STRONGLY_SUPPORTED_INFERENCE",
                confidence: "High"
            },
            {
                before: "Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard.",
                after: "Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard.",
                whyItIsWeak: "",
                whatInformationIsMissing: "",
                whyThisIsStronger: "",
                inferenceType: "EXPLICITLY_STATED",
                confidence: "High"
            }
          ] 
        }) } }]
      })
    };
  }

  return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
};

process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

async function test() {
  const preprocessedProfile = extractCandidateProfile(priyaResume);
  
  const engineResult = await runAnalysisPipeline({
    resumeText: priyaResume,
    jobDescriptionText: northlightJD,
    includePremium: true,
    candidateProfile: preprocessedProfile
  });
  
  const report = engineResult.legacyReport;
  console.log('Improved Bullet Points in backend:', report.improvedBulletPoints.map(b => b.improvementScore));

  // Let's import mapAiResults to test frontend mapping
  const { mapAiResumeToDisplay } = await import('./src/lib/api/mapAiResults.js');
  const frontendResults = mapAiResumeToDisplay(report);
  console.log('Bullets sent to UI:', frontendResults.bulletSuggestions?.length);
}

test().catch(console.error).finally(() => { globalThis.fetch = originalFetch; });


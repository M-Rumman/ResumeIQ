import { runAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';
import { createAiObservabilityContext } from './api/_lib/aiObservability.js';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const observability = createAiObservabilityContext(randomUUID());
    const result = await runAnalysisPipeline({
      resumeText: 'Test resume. I have 10 years of experience in software engineering.',
      jobDescriptionText: 'We need a software engineer with 5 years of experience.',
      includePremium: true
    }, { observability });
    console.log(result);
  } catch (err) {
    console.error('Pipeline error:', err);
  }
}

main();

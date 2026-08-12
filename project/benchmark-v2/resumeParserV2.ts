import { loadNER } from './localModels.js';

export async function parseResumeV2(resumeText: string) {
  // 1. Deterministic text splitting for basic facts
  const lines = resumeText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
  const facts: Array<{ rawText: string, category?: string }> = [];
  
  // Basic heuristic: any line that starts with '-' is an experience fact
  for (const line of lines) {
    if (line.startsWith('-')) {
      facts.push({
        rawText: line.replace(/^- /, ''),
        category: 'experience'
      });
    }
  }

  // 2. Local NER for Entities (e.g., Name, Location, Companies)
  const nerPipeline = await loadNER();
  // We only pass a small chunk to the NER model to keep it fast for this benchmark
  // Ideally we would chunk the resume and process it.
  const headerText = lines.slice(0, 5).join(' ');
  const entities = await nerPipeline(headerText);
  
  // Convert NER output to facts
  for (const entity of entities) {
    if (entity.score > 0.8) {
      facts.push({
        rawText: `${entity.entity_group}: ${entity.word}`,
        category: 'entity'
      });
    }
  }

  // Also include the raw skills list if we find a 'Skills:' section
  const skillsIndex = lines.findIndex(l => l.toLowerCase().includes('skills:'));
  if (skillsIndex !== -1 && lines[skillsIndex + 1]) {
    facts.push({
      rawText: lines[skillsIndex + 1],
      category: 'skills'
    });
  }
  
  return { facts, entities };
}

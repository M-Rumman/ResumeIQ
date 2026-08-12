export function parseJdV2(jdText: string) {
  const requirements: Array<{ id: string, source_text: string, requirement_type: 'explicit', category: string }> = [];
  
  // 1. Basic Heuristic for Years of Experience
  const expRegex = /([0-9]+)\+?\s*years?\s+(?:of\s+)?([a-zA-Z\s]+)?experience/i;
  const expMatch = jdText.match(expRegex);
  if (expMatch) {
    requirements.push({
      id: `req-exp`,
      source_text: expMatch[0],
      requirement_type: 'explicit',
      category: 'experience'
    });
  }

  // 2. Basic Heuristic for Degree
  const degreeRegex = /(Bachelor|Master|PhD|B\.A\.|B\.S\.|M\.S\.)(?:'s)?\s*(?:degree)?\s*(?:in\s+([a-zA-Z,\s]+))?/i;
  const degreeMatch = jdText.match(degreeRegex);
  if (degreeMatch) {
    requirements.push({
      id: `req-deg`,
      source_text: degreeMatch[0],
      requirement_type: 'explicit',
      category: 'education'
    });
  }

  // 3. Fallback: extract bullet points under 'Requirements:'
  const requirementsSectionMatch = jdText.match(/Requirements:([\s\S]*?)(?:Responsibilities:|Benefits:|$)/i);
  if (requirementsSectionMatch) {
    const section = requirementsSectionMatch[1];
    const bullets = section.split('\n').filter(line => line.trim().startsWith('*') || line.trim().startsWith('-'));
    
    bullets.forEach((bullet, index) => {
      const cleanText = bullet.replace(/^[*-]\s*/, '').trim();
      // Skip if we already extracted it via regex
      if (!cleanText.includes(expMatch?.[0] || '___') && !cleanText.includes(degreeMatch?.[0] || '___')) {
        requirements.push({
          id: `req-bullet-${index}`,
          source_text: cleanText,
          requirement_type: 'explicit',
          category: 'hard skill' // simplified
        });
      }
    });
  }

  return { requirements };
}

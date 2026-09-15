export interface UnquantifiedBullet {
  id: string;
  originalText: string;
  detectedTopic: string;
  suggestedMetricType: 'percentage' | 'revenue_cost' | 'volume_scale' | 'time_saved';
  promptQuestion: string;
  exampleMetric: string;
  generatedXyzTemplates: string[];
}

export function findUnquantifiedBullets(text: string): UnquantifiedBullet[] {
  const METRIC_PATTERN = /(?:\b\d+(?:\.\d+)?(?:%|x|k|m|b|\+)?\b|\$\d+[\d,]*(?:\.\d+)?|\b(?:million|billion|thousand)\b)/i;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[•\-*]|\d+\.\s+/.test(l));

  const results: UnquantifiedBullet[] = [];

  for (let i = 0; i < bullets.length; i++) {
    const rawBullet = bullets[i];
    const cleanText = rawBullet.replace(/^[•\-*\d.]+\s*/, '').trim();

    // Skip very short lines or headers
    if (cleanText.length < 20) continue;

    // Check if bullet lacks numbers/metrics
    if (!METRIC_PATTERN.test(cleanText)) {
      const lower = cleanText.toLowerCase();

      let suggestedMetricType: UnquantifiedBullet['suggestedMetricType'] = 'percentage';
      let promptQuestion = 'What was the percentage improvement or efficiency gain?';
      let exampleMetric = 'by 25%';
      let detectedTopic = 'Performance & Efficiency';

      if (/sales|revenue|cost|budget|expense|contract|deal|roi/i.test(lower)) {
        suggestedMetricType = 'revenue_cost';
        promptQuestion = 'How much revenue was generated or dollars saved?';
        exampleMetric = '$150,000';
        detectedTopic = 'Financial & Revenue Impact';
      } else if (/user|customer|client|traffic|download|request|query|record|data/i.test(lower)) {
        suggestedMetricType = 'volume_scale';
        promptQuestion = 'What was the scale, traffic volume, or number of users/clients?';
        exampleMetric = '100,000+ monthly active users';
        detectedTopic = 'Scale & Volume';
      } else if (/time|hour|latency|speed|delay|deploy|pipeline|cycle/i.test(lower)) {
        suggestedMetricType = 'time_saved';
        promptQuestion = 'How much time was saved or how much faster did the system run?';
        exampleMetric = 'saving 15 hours per week';
        detectedTopic = 'Speed & Time Savings';
      }

      const templates = [
        `Accelerated ${cleanText.replace(/^[a-z]+\s+/i, '')}, resulting in ${exampleMetric} improvement across core operations.`,
        `Spearheaded ${cleanText.replace(/^[a-z]+\s+/i, '')}, driving an estimated ${exampleMetric} gain while maintaining 99.9% reliability.`,
        `Optimized key workflows to deliver ${cleanText.replace(/^[a-z]+\s+/i, '')}, outperforming quarterly targets by ${exampleMetric}.`,
      ];

      results.push({
        id: `bullet_${i}`,
        originalText: rawBullet,
        detectedTopic,
        suggestedMetricType,
        promptQuestion,
        exampleMetric,
        generatedXyzTemplates: templates,
      });
    }
  }

  return results;
}

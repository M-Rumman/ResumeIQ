import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use local cache and optimize for Node.js
env.allowLocalModels = false;
env.useBrowserCache = false;

// Simulated Reranker using a cross-encoder model available on ONNX
export async function loadReranker() {
  console.log('Loading BGE Reranker (Xenova/bge-reranker-base)...');
  const reranker = await pipeline('text-classification', 'Xenova/bge-reranker-base', {
    quantized: true, // Use int8 for speed
  });
  return async (requirement: string, candidateFact: string) => {
    const result = await reranker(requirement, { text_pair: candidateFact });
    console.log("RAW RERANKER:", result);
    // BGE reranker outputs a logit or probability score
    // Xenova/bge-reranker-base outputs a score where higher is better
    const score = Array.isArray(result) ? result[0].score : (result as any).score;
    return score;
  };
}

// Simulated NER using a standard ONNX BERT NER model
export async function loadNER() {
  console.log('Loading NER (Xenova/bert-base-NER)...');
  const ner = await pipeline('token-classification', 'Xenova/bert-base-NER', {
    quantized: true,
  });
  return async (text: string) => {
    const result = await ner(text);
    return result;
  };
}

export async function scoreMatch(reranker: any, req: string, fact: string) {
  const score = await reranker(req, fact);
  if (score > 0.8) return 'EXACT_MATCH';
  if (score > 0.5) return 'STRONG_SEMANTIC_MATCH';
  if (score > 0.3) return 'PARTIAL_MATCH';
  if (score > 0.1) return 'RELATED_MATCH';
  return 'MISSING';
}

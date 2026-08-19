import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';
import { evaluateBulletGrounding } from '../../api/_lib/analysis-engine/evaluator.js';

const before = 'Maintained legacy systems using Java';
const after = 'Orchestrated the maintenance of legacy systems using Java';

const grounding = evaluateBulletGrounding(after, before, ['Java']);
console.log('Grounding:', grounding);

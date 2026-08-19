import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';

const before = 'Maintained legacy systems using Java';
const after = 'Orchestrated the maintenance of legacy systems using Java';

const bScore = scoreBulletQuality(before, ['Java']).total;
const aScore = scoreBulletQuality(after, ['Java']).total;

console.log('Before score:', bScore);
console.log('After score:', aScore);

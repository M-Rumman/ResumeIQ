import { useEffect, useState } from 'react';
import {
  FileText,
  Target,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Sparkles,
  Zap,
  ArrowDown,
  Download,
  Lock,
} from 'lucide-react';
import LogoMark from '../components/LogoMark';
import { supabase } from '../lib/supabase.js';
import { fetchAiResumeAnalysis, type Gap } from '../lib/api/analyzeResume.js';
import { ApiRequestError, apiPost } from '../lib/api/client.js';
import {
  mapAiResumeToDisplay,
  type PremiumResumeDisplayResults,
  type ResumeDisplayResults,
} from '../lib/api/mapAiResults.js';
import {
  checkFeatureAccess,
  FEATURE_TYPES,
} from '../lib/usageLimits.js';
import UpgradePrompt from '../components/UpgradePrompt';
import ResumeFileUpload from '../components/ResumeFileUpload';
import { canExportPdf } from '../lib/planAccess.js';
import { FREE_DAILY_RESUME_LIMIT } from '../lib/planConfig.js';
import { downloadResumeAnalysisPdf } from '../utils/exportReportPdf.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import DailyUsageLimitModal from '../components/DailyUsageLimitModal';

type AnalysisResults = ResumeDisplayResults;
type PremiumResults = PremiumResumeDisplayResults;

const STRONG_BULLET_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'analyzed', 'architected', 'assembled', 'automated', 'built',
  'coordinated', 'created', 'delivered', 'designed', 'developed', 'engineered', 'fabricated',
  'implemented', 'improved', 'integrated', 'led', 'managed', 'optimized', 'presented',
  'produced', 'reduced', 'streamlined', 'tested', 'validated',
]);

function firstWord(text: string) {
  return text.trim().match(/[A-Za-z]+/)?.[0]?.toLowerCase() || '';
}

function hasQuantification(text: string) {
  return /(?:\b\d+(?:\.\d+)?(?:%|x)?\b|\[x\]\s*(?:%|users|components|requests))/i.test(text);
}

const GENERIC_BULLET_OPENERS = new Set([
  'assisted', 'helped', 'participated', 'responsible', 'supported', 'worked',
]);
type BulletQuality = {
  total: number;
  actionVerb: number;
  keywordRichness: number;
  measurableImpact: number;
  sentenceClarity: number;
  ownershipStructure: number;
};

function containsTerm(text: string, term: string) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

/** Deterministic writing-quality score; it is not an LLM estimate or a random number. */
function supportsTargetKeyword(text: string, keyword: string): boolean {
  if (containsTerm(text, keyword)) return true;
  const normalized = text.toLowerCase();
  const target = keyword.toLowerCase();
  if (target === 'control systems') return /\bpid\b|\bcontrol(?:ler)?\b/.test(normalized);
  if (target === 'sensor integration') return /\bsensor|lidar\b/.test(normalized) && /\binterface|interfacing|integrat/.test(normalized);
  return false;
}

function scoreBulletQuality(text: string, targetKeywords: string[]): BulletQuality {
  const words = text.trim().match(/[A-Za-z0-9+#]+/g) || [];
  const opener = firstWord(text);
  const actionVerb = STRONG_BULLET_ACTION_VERBS.has(opener) ? 30 : GENERIC_BULLET_OPENERS.has(opener) ? 5 : 15;
  const keywordRichness = Math.min(25, [...new Set(targetKeywords.map((term) => term.trim()).filter(Boolean))]
    .filter((term) => supportsTargetKeyword(text, term)).length * 8.5);
  const measurableImpact = hasQuantification(text) ? (text.includes('[X]') || text.includes('[x]') ? 12 : 20) : 0;
  const sentenceClarity = words.length >= 12 && words.length <= 42 ? 15 : words.length >= 7 && words.length <= 55 ? 8 : 4;
  const ownershipStructure = STRONG_BULLET_ACTION_VERBS.has(opener)
    && words.length >= 10
    ? 10
    : 0;
  const total = Math.round(actionVerb + keywordRichness + measurableImpact + sentenceClarity + ownershipStructure);
  return { total, actionVerb, keywordRichness, measurableImpact, sentenceClarity, ownershipStructure };
}

function bulletQualityImprovements(before: BulletQuality, after: BulletQuality) {
  const improvements = [
    [after.actionVerb > before.actionVerb, 'Stronger action verb'],
    [after.keywordRichness > before.keywordRichness, 'Better ATS keywords for this role'],
    [after.measurableImpact > before.measurableImpact, 'More measurable impact'],
    [after.sentenceClarity > before.sentenceClarity, 'Clearer sentence structure'],
    [after.ownershipStructure > before.ownershipStructure, 'Clearer ownership and contribution structure'],
  ] as const;
  return improvements.filter(([improved]) => improved).map(([, label]) => label);
}

/**
 * Explanations are derived only from the original and server-validated rewrite.
 * They identify the type of detail a candidate should add, without claiming an
 * unsupported tool, outcome, or metric exists in the source resume.
 */
export function buildBulletTeachingGuide({ before, after }: PremiumResults['bulletSuggestions'][number]) {
  const originalStartsStrong = STRONG_BULLET_ACTION_VERBS.has(firstWord(before));
  const rewrittenVerb = firstWord(after);
  const originalHasMetric = hasQuantification(before);
  const rewrittenIsMoreDetailed = after.trim().split(/\s+/).length > before.trim().split(/\s+/).length + 3;

  const whyWeak = [
    originalStartsStrong
      ? 'The contribution is not specific enough for a recruiter to quickly understand the work performed.'
      : 'It starts with generic wording instead of a clear, specific action.',
    originalHasMetric
      ? 'The technical context or outcome is not explained clearly enough.'
      : 'It does not show the scope, outcome, or measurable result of the work.',
  ];

  const missingInformation = [
    rewrittenIsMoreDetailed
      ? 'The specific technical contribution, components, methods, or context already supported by the resume.'
      : 'A clearer explanation of the candidate\'s specific contribution.',
    originalHasMetric
      ? 'A direct connection between the work and its result or impact.'
      : 'A supported outcome, scope, or metric, if one is available.',
  ];

  const whyStronger = [
    rewrittenVerb
      ? `Begins with the clear action verb “${rewrittenVerb.charAt(0).toUpperCase()}${rewrittenVerb.slice(1)}.”`
      : 'Uses a clearer action-to-contribution structure.',
    rewrittenIsMoreDetailed
      ? 'Makes the documented technical contribution easier to understand while preserving the original meaning.'
      : 'Uses more direct professional resume language while preserving the original meaning.',
    'Gives recruiters and ATS systems clearer, resume-supported evidence of the candidate\'s work.',
  ];

  return { whyWeak, missingInformation, whyStronger };
}

/** Bullet-specific coaching derived from the validated source/rewrite pair only. */
function buildDetailedBulletTeachingGuide(
  { before, after }: PremiumResults['bulletSuggestions'][number],
  targetKeywords: string[],
) {
  const targetTerms = targetKeywords.filter((term) => containsTerm(after, term) && !containsTerm(before, term));
  const purpose = after.match(/\bto\s+([^.;]+)/i)?.[1]?.trim();
  const genericOpening = GENERIC_BULLET_OPENERS.has(firstWord(before));

  const whyWeak = [
    genericOpening
      ? `Opens with “${firstWord(before)},” which does not clearly show ownership of the work.`
      : `Does not clearly connect the documented work to a specific professional objective.`,
    targetTerms.length > 0
      ? 'This bullet does not name the specific tools, technologies, or methodologies involved.'
      : 'Uses generic phrasing but gives limited context about how skills were applied.',
    hasQuantification(before)
      ? 'This bullet does not clearly explain the purpose or practical result of the work.'
      : 'This bullet does not state a supported outcome, scope, or measurable result.',
  ];

  const missingInformation = [
    targetTerms.length
      ? `Detected in the source bullet: ${targetTerms.slice(0, 3).join(', ')}.`
      : 'Not explicitly stated in this bullet: tools, technologies, or methodologies used. Check other resume sections before treating this as missing.',
    purpose
      ? `Detected professional objective: ${purpose}.`
      : 'Not explicitly stated in this bullet: the professional purpose. Do not assume it is missing from the rest of the resume.',
    hasQuantification(before)
      ? 'Detected: a clear link between the documented work and its practical outcome.'
      : 'Unsupported in this bullet: a metric, test result, scope, or performance outcome. Add one only if documented elsewhere.',
  ];

  const whyStronger = [
    `Makes ownership explicit with the action “${firstWord(after).replace(/^./, (letter) => letter.toUpperCase())}.”`,
    targetTerms.length
      ? `Adds resume-supported professional context: ${targetTerms.slice(0, 3).join(', ')}.`
      : 'Makes the documented work easier for a recruiter to understand.',
    purpose
      ? `Clarifies the professional objective: ${purpose}.`
      : 'Uses a clearer action-to-contribution structure without adding unsupported results.',
    targetTerms.length
      ? `Improves alignment with this role through supported job terminology: ${targetTerms.slice(0, 2).join(', ')}.`
      : `Makes the documented work easier to evaluate against this role's stated requirements without adding unsupported job terminology.`,
  ];
  return { whyWeak, missingInformation, whyStronger };
}

function BulletImprovementGuide({
  items,
  targetKeywords,
}: {
  items: PremiumResults['bulletSuggestions'];
  targetKeywords: string[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-[#3c4a59]" />
        <h3 className="font-bold text-gray-900">Resume Bullet Improvements</h3>
      </div>
      <p className="text-sm text-gray-700 mb-6">
        Each suggestion explains the weakness and uses only resume-supported information in its improved version.
      </p>
      {items.length > 0 ? (
        <div className="space-y-6">
          {items.map((item, i) => {
            const guide = buildDetailedBulletTeachingGuide(item, targetKeywords);
            const beforeQuality = scoreBulletQuality(item.before, targetKeywords);
            const afterQuality = scoreBulletQuality(item.after, targetKeywords);
            const improvements = bulletQualityImprovements(beforeQuality, afterQuality);
            return (
              <article key={`${item.before}-${i}`} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid md:grid-cols-[1fr_auto_1fr] items-stretch bg-gray-100 gap-px">
                  <div className="bg-red-50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Before</span>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-800">Score {beforeQuality.total}/100</span>
                    </div>
                    <p className="text-sm text-red-950">{item.before}</p>
                  </div>
                  <div className="bg-white flex items-center justify-center px-4 py-3">
                    <ArrowDown className="w-5 h-5 text-[#3c4a59] md:rotate-[-90deg]" aria-label="Improved to" />
                  </div>
                  <div className="bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">After</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">Score {afterQuality.total}/100</span>
                    </div>
                    <p className="text-sm text-emerald-950 font-medium">{item.after}</p>
                  </div>
                </div>
                <div className="border-y border-gray-100 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-gray-900">Improvement Score: {afterQuality.total - beforeQuality.total >= 0 ? '+' : ''}{afterQuality.total - beforeQuality.total}</h4>
                    <span className="text-xs font-bold text-gray-700">Grounding confidence: {item.confidence}</span>
                  </div>
                  <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-emerald-800">
                    {(improvements.length ? improvements : ['More complete, resume-supported explanation of the work']).map((improvement) => <li key={improvement}>+ {improvement}</li>)}
                  </ul>
                </div>
                <div className="grid md:grid-cols-2 gap-px bg-gray-100">
                  <div className="bg-white p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">Why it is weak</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                      {guide.whyWeak.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">What information is missing</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                      {guide.missingInformation.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Why this is stronger</h4>
                  <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                    {guide.whyStronger.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          Paste experience or project bullets in your resume to receive grounded improvement guidance.
        </p>
      )}
    </div>
  );
}



export function AtsScoreExplanation({ explanation }: { explanation: PremiumResults['engine']['atsScoreExplanation'] }) {
  const hasDetails = explanation.whatIncreasedScore.length
    || explanation.whatReducedScore.length
    || explanation.topImprovements.length;
  if (!hasDetails) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 text-xs">
      {explanation.whatIncreasedScore.length > 0 && (
        <div>
          <p className="font-bold text-emerald-700 mb-1">What increased your score</p>
          <p className="text-gray-700">{explanation.whatIncreasedScore.slice(0, 3).join(' · ')}</p>
        </div>
      )}
      {explanation.whatReducedScore.length > 0 && (
        <div>
          <p className="font-bold text-amber-700 mb-1">What reduced your score</p>
          <p className="text-gray-700">{explanation.whatReducedScore.slice(0, 3).join(' · ')}</p>
        </div>
      )}
      {explanation.topImprovements.length > 0 && (
        <div>
          <p className="font-bold text-[#3c4a59] mb-1">Highest-impact improvements</p>
          <ol className="space-y-1 text-gray-700 list-decimal list-inside">
            {explanation.topImprovements.map((item) => <li key={item}>{item}</li>)}
          </ol>
          <p className="mt-2 font-semibold text-[#3c4a59]">
            Potential ATS: {explanation.potentialAtsScore}% (estimated +{explanation.estimatedScoreImprovement} points)
          </p>
        </div>
      )}
    </div>
  );
}


function ResumeQualityCard({ breakdown }: { breakdown: PremiumResults['engine']['atsBreakdown'] }) {
  const qualityItems = breakdown.filter(i => i.label !== 'Section Recognition' && i.label !== 'Readability & Formatting');
  if (qualityItems.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-5 h-5 text-[#3c4a59]" />
        <h3 className="font-bold text-gray-900">Resume Quality</h3>
      </div>
      <div className="space-y-3">
        {qualityItems.map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-50 px-4 py-3 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
              <span className="text-xs font-extrabold text-[#3c4a59]">{item.score} / {item.maximum}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-700 whitespace-pre-line">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AtsHealthCard({ breakdown }: { breakdown: PremiumResults['engine']['atsBreakdown'] }) {
  const healthItems = breakdown.filter(i => i.label === 'Section Recognition' || i.label === 'Readability & Formatting');
  if (healthItems.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900">ATS Health</h3>
      </div>
      <div className="space-y-3">
        {healthItems.map((item) => (
          <div key={item.label} className="rounded-lg bg-emerald-50 px-4 py-3 border border-emerald-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-900">{item.label}</p>
              <span className="text-xs font-extrabold text-emerald-800">{item.score} / {item.maximum}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800 whitespace-pre-line">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


function JobMatchExplanation({ explanation }: { explanation: PremiumResults['engine']['jobMatchExplanation'] }) {
  const hasDetails = explanation.strongMatches.length || explanation.partialMatches.length || explanation.missingSkills.length;
  if (!hasDetails) return null;

  const renderItem = (item: any) => (
    <div key={item.requirement} className="mb-2 last:mb-0">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-gray-900">{item.requirement}</span>
        {item.tag === 'Addressable by rewording' && (
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {item.tag}
          </span>
        )}
        {item.tag === 'Genuine gap' && (
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800">
            {item.tag}
          </span>
        )}
      </div>
      <p className="text-gray-600 mt-0.5 leading-snug">{item.context}</p>
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 text-xs">
      {explanation.strongMatches.length > 0 && (
        <div>
          <p className="font-bold text-emerald-700 mb-2">Top reasons you match</p>
          <div>{explanation.strongMatches.map(renderItem)}</div>
        </div>
      )}
      {explanation.missingSkills.length > 0 && (
        <div>
          <p className="font-bold text-red-700 mb-2">Top gaps</p>
          <div>{explanation.missingSkills.map(renderItem)}</div>
        </div>
      )}
      {explanation.partialMatches.length > 0 && (
        <div>
          <p className="font-bold text-[#3c4a59] mb-2">How the score was earned</p>
          <div>{explanation.partialMatches.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}

function KeywordCompatibilityCard({ compatibility }: { compatibility: PremiumResults['engine']['keywordCompatibility'] }) {
  const groups = [
    { title: 'Exact Match', icon: '✓', items: compatibility.exactMatches || [], className: 'border-emerald-100 bg-emerald-50 text-emerald-900', iconClassName: 'text-emerald-700' },
    { title: 'Semantic Match', icon: '~', items: compatibility.semanticMatches || [], className: 'border-blue-100 bg-blue-50 text-blue-900', iconClassName: 'text-blue-700' },
    { title: 'Under-Expressed', icon: '!', items: compatibility.underExpressed || [], className: 'border-amber-100 bg-amber-50 text-amber-900', iconClassName: 'text-amber-700' },
    { title: 'Missing', icon: '✗', items: compatibility.missing || [], className: 'border-red-100 bg-red-50 text-red-900', iconClassName: 'text-red-700' },
  ];

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3c4a59]" />
          <h3 className="font-bold text-gray-900">Keyword Compatibility</h3>
        </div>
        <span className="text-sm font-bold text-[#3c4a59]">Overall Keyword Match: {compatibility.overallMatch}%</span>
      </div>
      <ProgressBar value={compatibility.overallMatch} color="bg-gradient-to-r from-[#4a5a6a] to-[#3c4a59]" />

      <div className="grid gap-4 mt-5 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className={`rounded-xl border p-4 ${group.className}`}>
            <p className="text-sm font-bold mb-3">{group.title} ({group.items.length})</p>
            {group.items.length > 0 ? (
              <ul className="space-y-2">
                {group.items.map((keyword) => (
                  <li key={keyword} className="flex items-start gap-2 text-sm font-medium">
                    <span aria-hidden className={`font-extrabold ${group.iconClassName}`}>{group.icon}</span>
                    <span>{keyword}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm opacity-75">None identified</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-sm text-gray-800">
        <span><strong>Exact:</strong> {compatibility.exactMatches?.length || 0}</span>
        <span><strong>Semantic:</strong> {compatibility.semanticMatches?.length || 0}</span>
        <span><strong>Under-Expressed:</strong> {compatibility.underExpressed?.length || 0}</span>
        <span><strong>Missing:</strong> {compatibility.missing.length}</span>
      </div>
    </section>
  );
}

function EducationAlignmentCard({ items }: { items: PremiumResults['engine']['educationAlignment'] }) {
  if (items.length === 0) return null;
  const statusStyle = {
    'Direct Match': 'border-emerald-100 bg-emerald-50 text-emerald-900',
    'Related Match': 'border-amber-100 bg-amber-50 text-amber-900',
    Missing: 'border-red-100 bg-red-50 text-red-900',
  } as const;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="font-bold text-gray-900">Education Alignment</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.requirement} className={`rounded-xl border p-4 ${statusStyle[item.status]}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-sm">{item.requirement}</p>
              <span className="text-xs font-extrabold">{item.status} {item.confidence ? `· ${item.confidence}%` : ''}</span>
            </div>
            {item.evidence[0] && <p className="mt-2 text-xs leading-5">Evidence — {item.evidence[0].section}: “{item.evidence[0].text}”</p>}
            {item.reason && <p className="mt-1 text-xs leading-5 opacity-90">{item.reason}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function HiringManagerAssessmentCard({ assessment }: { assessment: PremiumResults['engine']['hiringManagerAssessment'] }) {
  const decisionStyle = {
    'Strong Match': 'bg-emerald-100 text-emerald-800',
    'Good Match': 'bg-green-100 text-green-800',
    'Potential Match': 'bg-amber-100 text-amber-800',
    'Weak Match': 'bg-orange-100 text-orange-800',
    'Poor Match': 'bg-red-100 text-red-800',
  } as const;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3c4a59]" />
          <h3 className="font-bold text-gray-900">Evidence-Based Hiring Summary</h3>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${decisionStyle[assessment.overallDecision]}`}>
          {assessment.overallDecision}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900 mb-3">Why You Are Likely To Be Interviewed</p>
          {assessment.topReasonsToInterview.length > 0 ? (
            <ul className="space-y-3">
              {assessment.topReasonsToInterview.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm leading-6 text-emerald-950"><CheckCircle2 className="w-4 h-4 mt-1 shrink-0 text-emerald-700" />{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-emerald-950">No direct resume-to-job requirement matches were identified yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-900 mb-3">Why You Might Be Rejected</p>
          {assessment.topReasonsForRejection.length > 0 ? (
            <ul className="space-y-3">
              {assessment.topReasonsForRejection.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm leading-6 text-red-950"><AlertCircle className="w-4 h-4 mt-1 shrink-0 text-red-600" />{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-red-950">No material job requirement is currently marked as not evidenced in the resume.</p>
          )}
        </div>
      </div>
    </div>
  );
}


function TopStrengthsCard({ breakdown }: { breakdown: any[] }) {
  const strengths = breakdown?.filter(b => b.classification === 'EXACT_MATCH' || b.classification === 'STRONG_SEMANTIC_MATCH') || [];
  if (strengths.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900">Top Strengths</h3>
      </div>
      <ul className="space-y-3">
        {strengths.slice(0, 10).map((strength: any, i: number) => (
          <li key={i} className="flex flex-col gap-1 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-950">{strength.requirement?.normalized_name}</p>
            </div>
            {strength.evidence?.[0] && (
               <p className="text-xs text-emerald-800 ml-7">Evidence: "{strength.evidence[0].source_text}"</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BiggestOpportunitiesCard({ actionPlan }: { actionPlan: Gap[] }) {
  if (!actionPlan || actionPlan.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900">Biggest Opportunities</h3>
      </div>
      <ul className="space-y-3">
        {actionPlan.slice(0, 5).map((gap, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <a 
              href={`#req-${gap.requirement.replace(/\s+/g, '-').toLowerCase()}`} 
              className="text-sm text-amber-950 hover:underline font-medium"
            >
              Add {gap.requirement} to your {gap.whereToAdd.toLowerCase().replace('.', '')}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementBreakdownCard({ breakdown, actionPlan }: { breakdown: any[]; actionPlan: Gap[] }) {
  if (!breakdown || breakdown.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-[#3c4a59]" />
        <h3 className="font-bold text-gray-900">Requirement Breakdown</h3>
      </div>
      <div className="space-y-4">
        {breakdown.map((item, i) => {
          const gap = actionPlan.find(g => g.requirement === item.requirement?.normalized_name);
          const reqId = `req-${item.requirement?.normalized_name.replace(/\s+/g, '-').toLowerCase()}`;
          return (
          <div key={i} id={reqId} className="border border-gray-200 rounded-xl p-4 bg-gray-50 scroll-mt-20">
            <div className="flex justify-between items-start mb-2">
               <div>
                 <p className="font-bold text-gray-900">{item.requirement?.normalized_name}</p>
                 <p className="text-xs text-gray-500 uppercase tracking-wide">{item.requirement?.priority} • {item.requirement?.category}</p>
               </div>
               <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
                 {item.classification}
               </span>
            </div>
            
            {gap ? (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="font-bold text-gray-900">Why it matters: </span>
                  <span className="text-gray-700">{gap.whyItMatters}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-900">Evidence: </span>
                  <span className="text-gray-700">{gap.evidenceStatus}</span>
                </div>
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-100 text-xs">
                  <span className="font-bold">⚠️ Important: </span>
                  {gap.fabricationWarning}
                </div>
              </div>
            ) : (
              <>
                {item.evidence && item.evidence.length > 0 ? (
                   <div className="mt-2 text-sm text-gray-700">
                     <strong>Evidence ({item.evidence[0].source_section}):</strong> "{item.evidence[0].source_text}"
                   </div>
                ) : (
                   <div className="mt-2 text-sm text-red-600">No evidence found in resume.</div>
                )}
                {item.explanation && (
                   <div className="mt-2 text-xs text-gray-600 italic">
                     {item.explanation}
                   </div>
                )}
              </>
            )}
          </div>
        )})}
      </div>
    </div>
  );
}

/** Final, API-backed verdict shown after every analysis section. */
function OverallAssessmentCard({ results }: { results: PremiumResults }) {
  const match = results.matchScore;
  const classification = results.engine.hiringManagerAssessment.overallDecision;
  const atsScore = results.atsScore;

  return (
    <section className="w-full rounded-3xl border-2 border-[#3c4a59] bg-[#f4f7f9] p-7 shadow-md sm:p-10 mb-8">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#3c4a59]/20 bg-white px-4 py-2 text-sm font-bold text-[#3c4a59]">
          <Target className="h-4 w-4" />
          Overall Result
        </div>
        <div className="grid sm:grid-cols-3 gap-6 text-center mt-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Job Match</p>
            <p className="text-4xl font-extrabold text-emerald-700">{match}%</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Classification</p>
            <p className="text-xl font-extrabold text-[#3c4a59] mt-2">{classification}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">ATS Parseability</p>
            <p className="text-4xl font-extrabold text-[#3c4a59]">{atsScore}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MatchScoreCalculationCard({ details }: { details: PremiumResults['matchScoreDetails'] }) {
  if (!details || !details.details) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-gray-50 pb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-gray-900">Match Score Calculation</h3>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">
            {Math.round(details.totalAchievedScore)} / {Math.round(details.totalMaxScore)} Points
          </p>
          <p className="text-xs text-gray-500">Achieved Score vs. Maximum Score</p>
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-xs text-gray-600 mb-2 font-medium">How points are awarded:</p>
        <ul className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 list-disc list-inside">
          <li><strong>Required Core:</strong> 10 pts max</li>
          <li><strong>Preferred Core:</strong> 5 pts max</li>
          <li><strong>Non-core:</strong> fewer pts max</li>
          <li><strong>Exact Match:</strong> 100% of max pts</li>
          <li><strong>Semantic Match:</strong> 85% of max pts</li>
          <li><strong>Partial Match:</strong> 50% of max pts</li>
        </ul>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-4 py-2 rounded-tl-lg">Requirement</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Match Type</th>
              <th className="px-4 py-2 text-right rounded-tr-lg">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {details.details.map((req: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{req.requirement}</td>
                <td className="px-4 py-2 text-xs">{req.priority}</td>
                <td className="px-4 py-2 text-xs">{req.classification}</td>
                <td className="px-4 py-2 text-right font-bold text-[#3c4a59]">
                  {Math.round(req.achievedPoints * 10) / 10} <span className="text-gray-400 font-normal">/ {req.maxPoints}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function analysisErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return 'Resume analysis could not be completed. Please try again in a few moments.';
  }

  if (error.pipelineError) {
    switch (error.pipelineError.stage) {
      case 'parser':
        if (error.pipelineError.code === 'JD_PARSING_FAILED') {
          return 'We could not extract job requirements from the provided job description. Please review the job description text and try again.';
        }
        if (error.pipelineError.code === 'UNAUTHORIZED_API_KEY') {
          return 'OpenRouter rejected your API key. Please check your environment variables or create a new key at openrouter.ai/keys.';
        }
        return 'We could not read the resume structure. Please review the extracted resume text and try again.';
      case 'analyzer':
        return 'The resume analysis service returned an incomplete analysis. Please try again in a few moments.';
      case 'rewriter':
        return 'The bullet-point improvement service returned an incomplete response. Please try again in a few moments.';
      case 'validation':
        return 'The generated analysis could not be verified against your resume. Please try again.';
      case 'planner':
        return 'The generated recommendations could not be organized safely. Please try again.';
    }
  }

  switch (error.code) {
    case 'timeout':
      return 'Resume analysis is taking longer than expected. Please try again in a few moments.';
    case 'network':
      return 'We could not connect to the resume analysis service. Please check your connection and try again.';
    case 'unauthorized':
      return 'Your session has expired. Please sign in again and retry your analysis.';
    case 'rate_limited':
      if (error.status === 429 && /today's free resume analysis limit/i.test(error.message)) {
        return error.message;
      }
      return 'Too many analysis requests were made. Please wait a moment and try again.';
    case 'service_unavailable':
      return 'Resume analysis is temporarily unavailable because the AI service is unavailable. Please try again in a few moments.';
    case 'malformed_response':
      return 'Resume analysis returned an incomplete response. Please try again in a few moments.';
    default:
      return 'Resume analysis could not be completed. Please try again in a few moments.';
  }
}

interface ResumeAnalyzerPageProps {
  onNavigate: (page: string) => void;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function ResumeAnalyzerPage({ onNavigate }: ResumeAnalyzerPageProps) {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState({
    used: 0,
    limit: FREE_DAILY_RESUME_LIMIT,
    isPro: false,
    loading: true,
  });
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const { userId, isPro } = usePaywallAccess(reportId);

  const paywallCheckout = usePaywallCheckout({
    userId,
    reportId,
  });

  const canExport = canExportPdf(isPro || usageInfo.isPro);

  async function refreshUsageStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUsageInfo({ used: 0, limit: FREE_DAILY_RESUME_LIMIT, isPro: false, loading: false });
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
    setUsageInfo({
      used: access.used,
      limit: access.limit === Infinity ? FREE_DAILY_RESUME_LIMIT : access.limit,
      isPro: access.isPro,
      loading: false,
    });
  }

  useEffect(() => {
    refreshUsageStatus();
  }, []);

  async function handleAnalyze() {
    setAnalyzing(true);
    setSaveSuccess(false);
    setSaveError(null);
    setUpgradeMessage(null);
    setResults(null);
    setReportId(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAnalyzing(false);
      setSaveError('You must be logged in to save an analysis.');
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);

    if (access.error) {
      setAnalyzing(false);
      setSaveError(access.error);
      return;
    }
    if (!access.allowed) {
      setAnalyzing(false);
      setShowDailyLimitModal(true);
      return;
    }

    const text = resumeText.trim();

    if (!text) {
      setAnalyzing(false);
      setSaveError('Please upload a resume or paste your resume text to continue.');
      return;
    }

    let analysisResults: AnalysisResults;
    try {
      const ai = await fetchAiResumeAnalysis(text, jobDescription.trim());
      analysisResults = mapAiResumeToDisplay(ai) as AnalysisResults;
    } catch (error) {
      setAnalyzing(false);
      if (error instanceof ApiRequestError && error.status === 429 && /today's free resume analysis limit/i.test(error.message)) {
        setShowDailyLimitModal(true);
        await refreshUsageStatus();
        return;
      }
      setSaveError(analysisErrorMessage(error));
      await refreshUsageStatus();
      return;
    }

    setAnalyzing(false);

    if (typeof (analysisResults as { reportId?: string | null }).reportId === 'string' && (analysisResults as { reportId?: string | null }).reportId) {
      setReportId((analysisResults as { reportId?: string | null }).reportId ?? null);
    }

    setResults(analysisResults);
    setSaveSuccess(true);
    await refreshUsageStatus();
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  const canAnalyze = resumeText.trim() && jobDescription.trim();

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <LogoMark className="w-10 h-10 rounded-xl" />
            <h1 className="text-3xl font-extrabold text-gray-900">AI Resume Analyzer</h1>
          </div>
          <p className="text-gray-900 text-base font-medium ml-[52px]">
            Upload a PDF or DOCX resume, or paste text, then add a job description for ATS feedback.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="glass-card-solid">
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900">Your Resume</h2>
              <p className="text-sm text-primary mt-1">Upload PDF/DOCX or paste your resume text below.</p>
            </div>
            <div className="p-6 space-y-4">
              <ResumeFileUpload
                disabled={analyzing}
                onTextExtracted={(text) => {
                  setResumeText(text);
                  setSaveError(null);
                }}
                onClear={() => setResumeText('')}
              />
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..."
                className="input-neu h-56 resize-none"
                data-clarity-mask="true"
              />
            </div>
          </div>

          <div className="glass-card-solid">
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900">Target Job Description</h2>
              <p className="text-sm text-primary mt-1">Paste the job posting to compare keyword match.</p>
            </div>
            <div className="p-6">
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
                className="input-neu h-56 resize-none"
                data-clarity-mask="true"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || analyzing}
            className={`flex items-center gap-3 font-semibold px-10 py-4 rounded-2xl text-base transition-all shadow-lg ${
              canAnalyze && !analyzing
                ? 'bg-[#3c4a59] text-white hover:bg-[#2e3a47] shadow-gray-300 hover:shadow-gray-400 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            {analyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                This may take a while
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze Resume
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {!canAnalyze && !results && (
          <p className="text-center text-xs text-primary mt-3">
            Please add your resume (upload or paste) and a job description to continue.
          </p>
        )}

        {upgradeMessage && (
          <div className="mt-6">
            <UpgradePrompt
              message={upgradeMessage}
              onUpgrade={() => paywallCheckout.subscribePro()}
            />
          </div>
        )}

        {saveError && (
          <p className="text-center text-sm text-red-600 font-medium mt-4">{saveError}</p>
        )}

        {results && (
          <div id="results-section" className="mt-14 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-px flex-1 bg-gray-200" />
                <h2 className="font-extrabold text-gray-900 text-xl px-4 whitespace-nowrap">Analysis Results</h2>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {results.tier === 'premium' && canExport && reportId ? (
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      await apiPost('/api/export-resume-report', { reportId });
                      await downloadResumeAnalysisPdf(results);
                    } catch (error) {
                      setSaveError(error instanceof Error ? error.message : 'PDF export is temporarily unavailable.');
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-[#3c4a59] bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {exportingPdf ? 'Exporting…' : 'Export PDF Report'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => paywallCheckout.subscribePro()}
                  className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  PDF Export (Pro)
                </button>
              )}
            </div>

            {saveSuccess && (
              <p className="text-center text-sm text-[#3c4a59] font-medium">
                Analysis saved successfully. View it anytime on your Dashboard.
              </p>
            )}

            {paywallCheckout.error && (
              <p className="text-center text-sm text-red-600 font-medium">{paywallCheckout.error}</p>
            )}
            {results.tier === 'premium' ? (
              <>
                <ResumeResultsBody results={results} />
                <OverallAssessmentCard results={results} />
              </>
            ) : (
              <>
                <ResumeResultsFree results={results} />
                <PremiumUpgradeCard
                  onUnlock={() => paywallCheckout.unlockReport()}
                  onUpgrade={() => paywallCheckout.subscribePro()}
                />
              </>
            )}
          </div>
        )}
      </div>
      {showDailyLimitModal && (
        <DailyUsageLimitModal
          featureLabel="Resume Analysis"
          onUpgrade={() => paywallCheckout.subscribePro()}
          onUnlockReport={() => onNavigate('pricing')}
          onDismiss={() => setShowDailyLimitModal(false)}
        />
      )}
    </div>
  );
}

function ResumeResultsBody({ results }: { results: PremiumResumeDisplayResults }) {
  return (
    <>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#3c4a59]" />
                    <h3 className="font-bold text-gray-900">ATS Compatibility</h3>
                  </div>
                  <span className="text-3xl font-extrabold text-[#3c4a59]">{results.atsScore}%</span>
                </div>
                <ProgressBar value={results.atsScore} color="bg-gradient-to-r from-[#4a5a6a] to-[#3c4a59]" />
                <AtsHealthCard breakdown={results.engine.atsBreakdown} />
                <ResumeQualityCard breakdown={results.engine.atsBreakdown} />
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-900">Job Match Score</h3>
                  </div>
                  <span className="text-3xl font-extrabold text-emerald-600">{results.matchScore}%</span>
                </div>
                <ProgressBar value={results.matchScore} color="bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <JobMatchExplanation explanation={results.engine.jobMatchExplanation} />
                <p className="text-xs text-gray-700 mt-2">
                  Your resume matches {results.matchScore}% of the job description requirements.
                </p>
              </div>
            </div>

            <MatchScoreCalculationCard details={results.matchScoreDetails} />
            <KeywordCompatibilityCard compatibility={results.engine.keywordCompatibility} />
            <EducationAlignmentCard items={results.engine.educationAlignment} />
            <HiringManagerAssessmentCard assessment={results.engine.hiringManagerAssessment} />
            <TopStrengthsCard breakdown={results.requirementBreakdown} />
            <BiggestOpportunitiesCard actionPlan={results.actionPlan} />
            <RequirementBreakdownCard breakdown={results.requirementBreakdown} actionPlan={results.actionPlan} />

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-[#3c4a59]" />
                <h3 className="font-bold text-gray-900">Resume Sections</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Detected</p>
                  <div className="flex flex-wrap gap-2">
                    {results.detectedSections.length > 0 ? (
                      results.detectedSections.map((section) => (
                        <span
                          key={section}
                          className="bg-green-50 text-green-800 border border-green-100 text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          {section}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-700">None detected</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Missing</p>
                  <div className="flex flex-wrap gap-2">
                    {results.missingSections.length > 0 ? (
                      results.missingSections.map((section) => (
                        <span
                          key={section}
                          className="bg-amber-50 text-amber-800 border border-amber-100 text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          {section}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-700">✓ All standard sections present</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <BulletImprovementGuide
              items={results.bulletSuggestions}
              targetKeywords={[
                ...(results.engine.keywordCompatibility.exactMatches || []),
                ...(results.engine.keywordCompatibility.semanticMatches || []),
                ...(results.engine.keywordCompatibility.missing || []),
              ]}
            />
    </>
  );
}

function ResumeResultsFree({ results }: { results: Extract<AnalysisResults, { tier: 'free' }> }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3c4a59]" />
          <h3 className="font-bold text-gray-900">Basic ATS Feedback</h3>
        </div>
        <span className="text-3xl font-extrabold text-[#3c4a59]">{results.atsScore}%</span>
      </div>
      <ProgressBar value={results.atsScore} color="bg-gradient-to-r from-[#4a5a6a] to-[#3c4a59]" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Detected sections</p>
          <p className="text-sm text-gray-800">{results.detectedSections.join(', ') || 'None detected'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Missing sections</p>
          <p className="text-sm text-gray-800">{results.missingSections.join(', ') || 'None identified'}</p>
        </div>
      </div>
      {results.basicFeedback.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm text-gray-800">
          {results.basicFeedback.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      )}
    </section>
  );
}

function PremiumUpgradeCard({ onUnlock, onUpgrade }: { onUnlock: () => void; onUpgrade: () => void }) {
  return (
    <section className="rounded-2xl border border-[#d7e2f0] bg-white p-6 text-center shadow-sm">
      <Lock className="mx-auto h-6 w-6 text-[#3c4a59]" />
      <h3 className="mt-3 text-lg font-extrabold text-gray-900">Unlock your complete resume report</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-700">
        Full job match, hiring manager assessment, missing skills, role-specific improvements, bullet rewrites, and PDF export are available with a report unlock or ResuV Pro.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" className="btn-primary" onClick={onUnlock}>Unlock Report — $2</button>
        <button type="button" className="btn-ghost" onClick={onUpgrade}>Upgrade to Pro</button>
      </div>
    </section>
  );
}

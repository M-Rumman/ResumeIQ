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
import { fetchAiResumeAnalysis } from '../lib/api/analyzeResume.js';
import { ApiRequestError } from '../lib/api/client.js';
import { mapAiResumeToDisplay, type ResumeDisplayResults } from '../lib/api/mapAiResults.js';
import {
  checkFeatureAccess,
  FEATURE_TYPES,
} from '../lib/usageLimits.js';
import UpgradePrompt from '../components/UpgradePrompt';
import ResumeFileUpload from '../components/ResumeFileUpload';
import PaywallBlurGate from '../components/PaywallBlurGate';
import PaywallCheckoutPreview from '../components/PaywallCheckoutPreview';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { canExportPdf } from '../lib/planAccess.js';
import { FREE_DAILY_RESUME_LIMIT } from '../lib/planConfig.js';
import { downloadResumeAnalysisPdf } from '../utils/exportReportPdf.js';
import { buildReportId } from '../lib/monetizationConfig.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';

type AnalysisResults = ResumeDisplayResults;

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
const TECHNICAL_BULLET_TERMS = [
  'api', 'arduino', 'ansys', 'assembly', 'autocad', 'cad', 'circuit', 'c++', 'c#',
  'data structure', 'debug', 'embedded', 'esp32', 'firmware', 'hardware', 'lidar',
  'ltspice', 'microcontroller', 'motor', 'pcb', 'pid', 'plc', 'proteus', 'protocol',
  'python', 'sensor', 'simulation', 'solidworks', 'stm32', 'testing', 'validation',
];
const ENGINEERING_DETAIL_TERMS = [
  'analy', 'architect', 'automat', 'calibrat', 'debug', 'design', 'develop', 'integrat',
  'implement', 'interface', 'optim', 'prototype', 'test', 'validat',
];

type BulletQuality = {
  total: number;
  actionVerb: number;
  technicalSpecificity: number;
  keywordRichness: number;
  engineeringDetail: number;
  measurableImpact: number;
  sentenceClarity: number;
};

function containsTerm(text: string, term: string) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

/** Deterministic writing-quality score; it is not an LLM estimate or a random number. */
function scoreBulletQuality(text: string, targetKeywords: string[]): BulletQuality {
  const words = text.trim().match(/[A-Za-z0-9+#]+/g) || [];
  const opener = firstWord(text);
  const actionVerb = STRONG_BULLET_ACTION_VERBS.has(opener) ? 20 : GENERIC_BULLET_OPENERS.has(opener) ? 4 : 9;
  const technicalSpecificity = Math.min(20, TECHNICAL_BULLET_TERMS.filter((term) => containsTerm(text, term)).length * 5);
  const keywordRichness = Math.min(20, [...new Set(targetKeywords.map((term) => term.trim()).filter(Boolean))]
    .filter((term) => containsTerm(text, term)).length * 7);
  const engineeringDetail = Math.min(15, ENGINEERING_DETAIL_TERMS
    .filter((term) => text.toLowerCase().includes(term)).length * 3);
  const measurableImpact = hasQuantification(text) ? (text.includes('[X]') || text.includes('[x]') ? 10 : 15) : 0;
  const sentenceClarity = words.length >= 10 && words.length <= 40 ? 10 : words.length >= 6 && words.length <= 55 ? 6 : 2;
  const total = actionVerb + technicalSpecificity + keywordRichness + engineeringDetail + measurableImpact + sentenceClarity;
  return { total, actionVerb, technicalSpecificity, keywordRichness, engineeringDetail, measurableImpact, sentenceClarity };
}

function bulletQualityImprovements(before: BulletQuality, after: BulletQuality) {
  const improvements = [
    [after.actionVerb > before.actionVerb, 'Stronger action verb'],
    [after.keywordRichness > before.keywordRichness, 'Better ATS keywords for this role'],
    [after.technicalSpecificity > before.technicalSpecificity, 'More technical specificity'],
    [after.engineeringDetail > before.engineeringDetail, 'More engineering detail'],
    [after.measurableImpact > before.measurableImpact, 'More measurable impact'],
    [after.sentenceClarity > before.sentenceClarity, 'Clearer sentence structure'],
  ] as const;
  return improvements.filter(([improved]) => improved).map(([, label]) => label);
}

/**
 * Explanations are derived only from the original and server-validated rewrite.
 * They identify the type of detail a candidate should add, without claiming an
 * unsupported tool, outcome, or metric exists in the source resume.
 */
function buildBulletTeachingGuide({ before, after }: AnalysisResults['bulletSuggestions'][number]) {
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

function technicalTermsIn(text: string) {
  return TECHNICAL_BULLET_TERMS.filter((term) => containsTerm(text, term));
}

/** Bullet-specific coaching derived from the validated source/rewrite pair only. */
function buildDetailedBulletTeachingGuide(
  { before, after }: AnalysisResults['bulletSuggestions'][number],
  targetKeywords: string[],
) {
  const beforeTerms = technicalTermsIn(before);
  const afterTerms = technicalTermsIn(after);
  const addedTerms = afterTerms.filter((term) => !beforeTerms.includes(term));
  const targetTerms = targetKeywords.filter((term) => containsTerm(after, term) && !containsTerm(before, term));
  const purpose = after.match(/\bto\s+([^.;]+)/i)?.[1]?.trim();
  const genericOpening = GENERIC_BULLET_OPENERS.has(firstWord(before));

  const whyWeak = [
    genericOpening
      ? `Opens with “${firstWord(before)},” which does not clearly show ownership of the work.`
      : `Does not clearly connect the documented ${beforeTerms.slice(0, 2).join(' and ') || 'engineering work'} to an engineering objective.`,
    beforeTerms.length === 0
      ? 'Does not name the components, technology, or engineering method involved.'
      : `Names ${beforeTerms.slice(0, 3).join(', ')} but gives limited context about how they were used.`,
    hasQuantification(before)
      ? 'Does not clearly explain the purpose or practical result of the work.'
      : 'Does not include a supported outcome, scope, or measurable result.',
  ];

  const missingInformation = [
    addedTerms.length
      ? `The documented technical context: ${addedTerms.slice(0, 3).join(', ')}.`
      : 'The specific components, technology, or method used in the work.',
    purpose
      ? `The engineering objective: ${purpose}.`
      : 'The engineering purpose the work was intended to support or enable.',
    hasQuantification(before)
      ? 'A clear link between the documented work and its practical outcome.'
      : 'A supported metric, test result, scope, or performance outcome, if available.',
  ];

  const whyStronger = [
    `Makes ownership explicit with the action “${firstWord(after).replace(/^./, (letter) => letter.toUpperCase())}.”`,
    addedTerms.length
      ? `Adds resume-supported technical context: ${addedTerms.slice(0, 3).join(', ')}.`
      : 'Makes the documented technical work easier for a recruiter to understand.',
    purpose
      ? `Clarifies the engineering objective: ${purpose}.`
      : 'Uses a clearer action-to-contribution structure without adding unsupported results.',
    targetTerms.length
      ? `Improves ATS relevance for this role through supported terminology: ${targetTerms.slice(0, 2).join(', ')}.`
      : 'Presents the documented work in clearer, recruiter-friendly language for this role.',
  ];
  return { whyWeak, missingInformation, whyStronger };
}

function BulletImprovementGuide({
  items,
  targetKeywords,
}: {
  items: AnalysisResults['bulletSuggestions'];
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

function ResumeCoachingReport({ results }: { results: AnalysisResults }) {
  const fallbackReport: AnalysisResults['engine']['coachingReport'] = [
    {
      category: 'Job Alignment',
      recommendations: results.jobSpecificImprovements.map((item) => item.text).slice(0, 3),
    },
    {
      category: 'ATS Formatting',
      recommendations: results.generalResumeImprovements.map((item) => item.text).slice(0, 3),
    },
  ].filter((section) => section.recommendations.length > 0);
  const sections = results.engine.coachingReport.length > 0
    ? results.engine.coachingReport
    : fallbackReport;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Resume Improvements</h3>
          <p className="text-sm text-gray-700 mt-1">
            Recruiter-style coaching grounded in your resume and this specific job description.
          </p>
        </div>
      </div>

      {sections.length > 0 ? (
        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          {sections.map((section) => (
            <article key={section.category} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <h4 className="font-bold text-gray-900 mb-3">{section.category}</h4>
              <ul className="space-y-3">
                {section.recommendations.map((recommendation) => (
                  <li key={recommendation} className="flex items-start gap-2.5 text-sm leading-6 text-gray-800">
                    <ArrowRight className="w-4 h-4 text-[#3c4a59] mt-1 flex-shrink-0" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-gray-700">
          Add more project or experience detail to receive role-specific coaching.
        </p>
      )}
    </section>
  );
}

function AtsScoreExplanation({ explanation }: { explanation: AnalysisResults['engine']['atsScoreExplanation'] }) {
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

function AtsBreakdown({
  breakdown,
  overallScore,
}: {
  breakdown: AnalysisResults['engine']['atsBreakdown'];
  overallScore: number;
}) {
  if (breakdown.length === 0) return null;

  return (
    <section className="mt-5 pt-5 border-t border-gray-100">
      <h4 className="text-sm font-bold text-gray-900 mb-3">ATS Breakdown</h4>
      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-gray-900">{item.label}</p>
              <span className="text-xs font-extrabold text-[#3c4a59]">{item.score} / {item.maximum}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-700">{item.explanation}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
        <span className="text-sm font-bold text-gray-900">Overall ATS</span>
        <span className="text-lg font-extrabold text-[#3c4a59]">{overallScore}%</span>
      </div>
    </section>
  );
}

function JobMatchExplanation({ explanation }: { explanation: AnalysisResults['engine']['jobMatchExplanation'] }) {
  const hasDetails = explanation.strongMatches.length || explanation.partialMatches.length || explanation.missingSkills.length;
  if (!hasDetails) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 text-xs">
      {explanation.strongMatches.length > 0 && (
        <div>
          <p className="font-bold text-emerald-700 mb-1">Top reasons you match</p>
          <p className="text-gray-700">{explanation.strongMatches.slice(0, 3).join(' · ')}</p>
        </div>
      )}
      {explanation.missingSkills.length > 0 && (
        <div>
          <p className="font-bold text-red-700 mb-1">Top gaps</p>
          <p className="text-gray-700">{explanation.missingSkills.slice(0, 3).join(' · ')}</p>
        </div>
      )}
      {explanation.partialMatches.length > 0 && (
        <div>
          <p className="font-bold text-[#3c4a59] mb-1">How the score was earned</p>
          <p className="text-gray-700">{explanation.partialMatches.slice(0, 3).join(' · ')}</p>
        </div>
      )}
    </div>
  );
}

function KeywordCompatibilityCard({ compatibility }: { compatibility: AnalysisResults['engine']['keywordCompatibility'] }) {
  const groups = [
    { title: 'Strong Match', icon: '✓', items: compatibility.strongMatches, className: 'border-emerald-100 bg-emerald-50 text-emerald-900', iconClassName: 'text-emerald-700' },
    { title: 'Partial Match', icon: '~', items: compatibility.partialMatches, className: 'border-amber-100 bg-amber-50 text-amber-900', iconClassName: 'text-amber-700' },
    { title: 'Missing', icon: '✗', items: compatibility.missing, className: 'border-red-100 bg-red-50 text-red-900', iconClassName: 'text-red-700' },
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
        <span><strong>Matched:</strong> {compatibility.strongMatches.length}</span>
        <span><strong>Partial:</strong> {compatibility.partialMatches.length}</span>
        <span><strong>Missing:</strong> {compatibility.missing.length}</span>
      </div>
    </section>
  );
}

function KeywordRecommendations({ recommendations }: { recommendations: AnalysisResults['keywordRecommendations'] }) {
  if (recommendations.length === 0) return null;
  const priorities = ['Critical', 'Important', 'Nice-to-Have'] as const;
  const priorityStyle = {
    Critical: 'text-red-700 border-red-100 bg-red-50',
    Important: 'text-amber-700 border-amber-100 bg-amber-50',
    'Nice-to-Have': 'text-[#3c4a59] border-gray-200 bg-gray-50',
  } as const;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <h3 className="font-bold text-gray-900">Missing Skills</h3>
      </div>
      <div className="space-y-5">
        {priorities.map((priority) => {
          const items = recommendations.filter((item) => item.priority === priority);
          if (items.length === 0) return null;
          return (
            <div key={priority}>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">{priority}</p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={`${item.priority}-${item.keyword}`} className={`rounded-xl border px-3 py-2.5 ${priorityStyle[priority]}`}>
                    <p className="text-sm font-bold">{item.keyword}</p>
                    <p className="mt-1 text-xs text-gray-700">{item.whyItMatters}</p>
                    <p className="mt-1.5 text-xs font-semibold text-gray-700">Natural place to mention it: {item.recommendedSection}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HiringManagerAssessmentCard({ assessment }: { assessment: AnalysisResults['engine']['hiringManagerAssessment'] }) {
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

function StrengthsMatchingRoleCard({ strengths }: { strengths: AnalysisResults['engine']['roleStrengths'] }) {
  if (strengths.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900">Strengths Matching This Role</h3>
      </div>
      <ul className="space-y-3">
        {strengths.map((strength) => (
          <li key={strength} className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-950">{strength}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Final, API-backed verdict shown after every analysis section. */
function OverallAssessmentCard({ results }: { results: AnalysisResults }) {
  const readiness = Math.max(0, Math.min(100, Math.round(results.engine.hiringManagerAssessment.estimatedInterviewProbability)));
  const explanation = readiness >= 75
    ? 'Your resume demonstrates strong alignment with this position. Addressing the remaining role-specific gaps could further improve your competitiveness.'
    : 'This AI estimate reflects how well your resume aligns with the employer\'s requirements. Improving the recommended areas above can strengthen your competitiveness for this specific role.';

  return (
    <section className="w-full rounded-3xl border-2 border-[#3c4a59] bg-[#f4f7f9] p-7 shadow-md sm:p-10">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#3c4a59]/20 bg-white px-4 py-2 text-sm font-bold text-[#3c4a59]">
          <Target className="h-4 w-4" />
          Overall Assessment
        </div>
        <p className="text-xl font-semibold leading-relaxed text-gray-900 sm:text-2xl">
          Your resume has <span className="text-4xl font-extrabold text-[#3c4a59] sm:text-5xl">{results.matchScore}%</span> alignment with this Job Description.
        </p>
        <p className="mt-5 text-lg font-medium leading-relaxed text-gray-800 sm:text-xl">
          Based on your current resume, our AI estimates that you have approximately{' '}
          <span className="text-4xl font-extrabold text-emerald-700 sm:text-5xl">{readiness}%</span>{' '}
          interview potential for this role.
        </p>
        <p className="mx-auto mt-7 max-w-3xl text-sm font-medium leading-6 sm:text-base" style={{ color: '#000000' }}>
          {explanation} This is an AI estimate based solely on this resume analysis, not a guarantee of an interview invitation.
        </p>
      </div>
    </section>
  );
}

function analysisErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return 'Resume analysis could not be completed. Please try again in a few moments.';
  }

  if (error.pipelineError) {
    switch (error.pipelineError.stage) {
      case 'parser':
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
  const [usageInfo, setUsageInfo] = useState({
    used: 0,
    limit: FREE_DAILY_RESUME_LIMIT,
    isPro: false,
    loading: true,
  });
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const {
    unlocked: reportUnlocked,
    userId,
    isPro,
    refresh: refreshPaywallAccess,
  } = usePaywallAccess(reportId);

  const paywallCheckout = usePaywallCheckout({
    userId,
    reportId,
  });

  const hasFullAccess = !PAYMENTS_ENABLED || reportUnlocked;
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
      setSaveError("You've reached today's free resume analysis limit. Your limit resets tomorrow or you can upgrade to Pro for unlimited analyses.");
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
      setSaveError(analysisErrorMessage(error));
      await refreshUsageStatus();
      return;
    }

    const strengths = analysisResults.improvements
      .filter((i) => i.type === 'success')
      .map((i) => i.text)
      .join('\n');
    const improvements = analysisResults.improvements
      .filter((i) => i.type !== 'success')
      .map((i) => `- ${i.text}`)
      .join('\n');

    const { data: inserted, error: insertError } = await supabase
      .from('resume_analysis')
      .insert({
        user_id: user.id,
        ats_score: analysisResults.atsScore,
        strengths: strengths || 'AI analysis completed.',
        improvements: improvements || '- See full report in app.',
      })
      .select('id')
      .single();

    setAnalyzing(false);

    if (insertError) {
      setSaveError('Analysis completed but could not be saved. Please try again.');
      return;
    }

    if (inserted?.id) {
      setReportId(buildReportId('resume_analysis', inserted.id));
    }

    setResults(analysisResults);
    setSaveSuccess(true);
    await refreshUsageStatus();
    await refreshPaywallAccess();
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
              {canExport ? (
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      await downloadResumeAnalysisPdf(results);
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

            {PAYMENTS_ENABLED && !hasFullAccess && (
              <p className="text-center text-xs text-primary">
                Premium sections are locked. Unlock this report for $2 or upgrade to Pro for $5/month.
              </p>
            )}

            {paywallCheckout.error && (
              <p className="text-center text-sm text-red-600 font-medium">{paywallCheckout.error}</p>
            )}

            {!PAYMENTS_ENABLED ? (
              <div className="space-y-8">
                <ResumeResultsBody results={results} />
                <PaywallCheckoutPreview onPricingSoon={() => onNavigate('pricing')} />
              </div>
            ) : (
              <>
                <div id="paywall-free-preview" className="space-y-8">
                  <ResumeResultsPreview results={results} />
                </div>
                <div className="space-y-8">
                  {hasFullAccess || !reportId ? (
                    <ResumeResultsPremium results={results} />
                  ) : (
                    <PaywallBlurGate
                      unlocked={false}
                      previewPercent={0}
                      reportId={reportId}
                      onUnlockReport={paywallCheckout.unlockReport}
                      onSubscribePro={paywallCheckout.subscribePro}
                    >
                      <ResumeResultsPremium results={results} />
                    </PaywallBlurGate>
                  )}
                </div>
              </>
            )}
            <OverallAssessmentCard results={results} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeResultsBody({ results }: { results: AnalysisResults }) {
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
                <AtsBreakdown breakdown={results.engine.atsBreakdown} overallScore={results.atsScore} />
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

            <KeywordCompatibilityCard compatibility={results.engine.keywordCompatibility} />
            <HiringManagerAssessmentCard assessment={results.engine.hiringManagerAssessment} />
            <StrengthsMatchingRoleCard strengths={results.engine.roleStrengths} />

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
                      <span className="text-sm text-gray-700">All standard sections found</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <KeywordRecommendations recommendations={results.keywordRecommendations} />

            <ResumeCoachingReport results={results} />

            <BulletImprovementGuide
              items={results.bulletSuggestions}
              targetKeywords={[
                ...results.engine.keywordCompatibility.strongMatches,
                ...results.engine.keywordCompatibility.partialMatches,
                ...results.engine.keywordCompatibility.missing,
              ]}
            />
    </>
  );
}

function ResumeResultsPreview({ results }: { results: AnalysisResults }) {
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
          <AtsBreakdown breakdown={results.engine.atsBreakdown} overallScore={results.atsScore} />
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
        </div>
      </div>
      <KeywordCompatibilityCard compatibility={results.engine.keywordCompatibility} />
      <HiringManagerAssessmentCard assessment={results.engine.hiringManagerAssessment} />
      <StrengthsMatchingRoleCard strengths={results.engine.roleStrengths} />
    </>
  );
}

function ResumeResultsPremium({ results }: { results: AnalysisResults }) {
  return (
    <>
      <KeywordRecommendations recommendations={results.keywordRecommendations} />

      <ResumeCoachingReport results={results} />

      <BulletImprovementGuide
        items={results.bulletSuggestions}
        targetKeywords={[
          ...results.engine.keywordCompatibility.strongMatches,
          ...results.engine.keywordCompatibility.partialMatches,
          ...results.engine.keywordCompatibility.missing,
        ]}
      />
    </>
  );
}

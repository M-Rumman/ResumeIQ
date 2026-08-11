import type { StructuredResume } from '../resumeParser.js';
import type { AiResumeAnalysisFull, AtsDisplayBreakdownItem, HiringManagerAssessment } from '../openrouter.js';

// Re-export legacy types needed for backward compatibility
export type { AiResumeAnalysisFull, AtsDisplayBreakdownItem, HiringManagerAssessment, StructuredResume };

// ==========================================
// 1. EXTRACTION LAYER (Job & Resume Facts)
// ==========================================

export type RequirementPriority = 'required' | 'preferred' | 'bonus';

export interface JobRequirement {
  id: string; // unique identifier
  category: 'hard skill' | 'soft skill' | 'experience' | 'education' | 'domain' | 'responsibility' | 'tool' | 'methodology' | 'seniority' | 'years' | 'location' | 'certification' | 'language' | 'other';
  normalized_name: string;
  original_text: string;
  source_section: string;
  source_span: [number, number]; // [start, end] indices in the original text
  source_text: string;
  priority: RequirementPriority;
  requirement_type: string; // The specific type (e.g., 'experience', 'education')
  confidence: number;

  // Type-specific fields
  domain?: string;
  minimum_years?: number;
  degree_level?: 'bachelor' | 'master' | 'phd' | 'associate' | 'high school' | 'any';
  fields?: string[];
}

export interface JobProfile {
  title: string;
  company?: string;
  requirements: JobRequirement[];
}

export interface CandidateFact {
  id: string; // unique identifier
  type: 'skill' | 'tool' | 'methodology' | 'education' | 'experience' | 'project' | 'certification' | 'language' | 'other';
  normalizedName: string;
  rawText: string;
  sourceSection: string;
  evidence: string; // Exact text from the resume proving this fact
  sectionInferred?: boolean; // True if the section header didn't exist but content was heuristically found

  // Education-specific
  degree_level?: 'bachelor' | 'master' | 'phd' | 'associate' | 'high school' | 'any';
  fields?: string[];

  // Experience-specific
  employment_duration_years?: number;
  companies?: string[];
  titles?: string[];
}

export interface CandidateProfile {
  contact: StructuredResume['contact'];
  facts: CandidateFact[];
  // Maintain original parsed structure for context
  rawStructure: StructuredResume;
}

// ==========================================
// 2. MATCHING LAYER (Cross-referencing)
// ==========================================

export type MatchClassification = 
  | 'EXACT_MATCH' 
  | 'STRONG_SEMANTIC_MATCH' 
  | 'PARTIAL_MATCH' 
  | 'RELATED_MATCH' 
  | 'UNDER_EXPRESSED'
  | 'MISSING'
  | 'ANALYSIS_FAILED';

export interface MatchEvidence {
  source_section: string;
  source_text: string;
  fact_id: string;
  relevance: string;
  evidence_strength: 'primary' | 'secondary' | 'weak';
}

export interface RequirementMatch {
  requirement: JobRequirement;
  classification: MatchClassification;
  confidence: number;
  evidence: MatchEvidence[];
  explanation: string;
}

export interface MatchingResult {
  matches: RequirementMatch[];
}

// ==========================================
// 3. EVALUATION LAYER (Scoring & ATS)
// ==========================================

export interface MatchScoreDetails {
  totalMaxScore: number;
  totalAchievedScore: number;
  rawMatchScore: number;
  details: {
    requirement: string;
    priority: string;
    classification: string;
    maxPoints: number;
    contributionMultiplier: number;
    confidenceMultiplier: number;
    achievedPoints: number;
  }[];
}

export interface EvaluationResult {
  atsScore: number;
  matchScore: number;
  atsBreakdown: AtsDisplayBreakdownItem[]; // Legacy UI compatibility
  scoreExplanations: {
    whatIncreasedScore: string[];
    whatReducedScore: string[];
  };
  matchScoreDetails: MatchScoreDetails;
}

// ==========================================
// 4. RECOMMENDATION LAYER (Improvements)
// ==========================================

export interface Recommendation {
  id: string;
  type: 'missing_skill' | 'weak_bullet' | 'formatting' | 'missing_section';
  priority: 'critical' | 'important' | 'optional';
  requirement: string;
  whyItMatters: string;
  whereToAdd: string;
  evidenceStatus: string;
  fabricationWarning: string;
  // If it's a weak bullet, this provides the rewrite based ONLY on existing facts
  originalText?: string;
  improvedText?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
}

// ==========================================
// 5. ORCHESTRATION LAYER (Pipeline)
// ==========================================

export interface PipelineContext {
  resumeText: string;
  jobDescriptionText: string;
  includePremium: boolean;
  candidateProfile?: CandidateProfile;
}

export interface EngineResult {
  tier: 'free' | 'premium';
  legacyReport: AiResumeAnalysisFull | any; // Any for free tier fallback
  timings?: Record<string, number>;
}

import { getSupabaseAdmin } from './supabaseAdmin.js';
import { commitSuccessfulDailyUsage, type FeatureType } from './dailyUsage.js';

export interface PersistAiResultOptions<TRecordId = string> {
  userId: string;
  featureType: FeatureType;
  shouldConsumeUsage: boolean;
  insertRecord: () => Promise<{ id: TRecordId }>;
  deleteRecord: (recordId: TRecordId) => Promise<void>;
  commitUsage: () => Promise<{ committed: boolean; used: number; limit: number }>;
  buildReportId: (recordId: TRecordId) => string;
}

export interface PersistAiResultSuccess<TRecordId = string> {
  recordId: TRecordId;
  reportId: string;
}

export async function persistAiResultAndCommitUsage<TRecordId = string>(
  options: PersistAiResultOptions<TRecordId>,
): Promise<PersistAiResultSuccess<TRecordId>> {
  const record = await options.insertRecord();

  if (!options.shouldConsumeUsage) {
    return { recordId: record.id, reportId: options.buildReportId(record.id) };
  }

  try {
    const usage = await options.commitUsage();
    if (!usage.committed) {
      throw new Error(`Daily free usage limit reached for ${options.featureType}`);
    }
    return { recordId: record.id, reportId: options.buildReportId(record.id) };
  } catch (error) {
    await options.deleteRecord(record.id);
    throw error;
  }
}

export async function insertResumeAnalysisRecord(userId: string, payload: {
  atsScore: number;
  strengths: string;
  improvements: string;
}): Promise<{ id: string }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('resume_analysis')
    .insert({
      user_id: userId,
      ats_score: payload.atsScore,
      strengths: payload.strengths,
      improvements: payload.improvements,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Resume analysis row insert failed.');
  }

  return { id: data.id as string };
}

export async function insertInterviewPrepRecord(userId: string, payload: {
  jobRole: string;
  hrQuestions: string;
  technicalQuestions: string;
  behavioralQuestions: string;
  starTips: string;
}): Promise<{ id: string }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('interview_prep')
    .insert({
      user_id: userId,
      job_role: payload.jobRole,
      hr_questions: payload.hrQuestions,
      technical_questions: payload.technicalQuestions,
      behavioral_questions: payload.behavioralQuestions,
      star_tips: payload.starTips,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Interview prep row insert failed.');
  }

  return { id: data.id as string };
}

export async function deleteResumeAnalysisRecord(recordId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('resume_analysis').delete().eq('id', recordId);
}

export async function deleteInterviewPrepRecord(recordId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('interview_prep').delete().eq('id', recordId);
}

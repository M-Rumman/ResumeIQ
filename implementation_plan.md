# Implementation Plan - Free Daily Usage Fix

This implementation plan details the changes required to ensure that free tries are only consumed for successful analyses in ResuV, and are never deducted when an error occurs.

## Forensic Explanation of Current Usage Flow

### 1. Current Usage Flow
1.  **Preflight check**: 
    *   Frontend: Calls `checkFeatureAccess` (reads profile daily counters via supabase API) to ensure tries are available before allowing submission.
    *   Backend: Calls `verifyAiFeatureAccess` in `analyze-resume.ts` / `interview-prep.ts`. This reads from the `profiles` table. No tries are incremented or reserved here.
2.  **AI execution**: Runs the AI pipeline (`runAnalysisPipeline` / `generateInterviewPrepWithAi`).
3.  **Commit after success**: 
    *   If pipeline completes without throwing, it calls `persistAiResultAndCommitUsage`.
    *   This function first saves the record to the database, then calls `commitSuccessfulDailyUsage` (which triggers the `complete_free_ai_usage` Postgres RPC).
    *   The `complete_free_ai_usage` RPC locks the profile row (`FOR UPDATE`), checks the quota, and increments the daily count.

### 2. Exact Files/Functions Involved
*   **Database RPC**: `public.complete_free_ai_usage(p_user_id, p_feature_type)` in [`20260731000000_commit_daily_usage_after_success.sql`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/supabase/migrations/20260731000000_commit_daily_usage_after_success.sql#L2).
*   **Backend daily check & commit**: [`project/api/_lib/dailyUsage.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/_lib/dailyUsage.ts) (`checkDailyUsage`, `commitSuccessfulDailyUsage`, `recordDailyUsage`).
*   **API Route Handlers**: [`project/api/analyze-resume.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/analyze-resume.ts) and [`project/api/interview-prep.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/interview-prep.ts).
*   **Persistence & Commit Wrapper**: [`project/api/_lib/aiPersistence.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/_lib/aiPersistence.ts) (`persistAiResultAndCommitUsage`).
*   **AI Engine Pipeline**: [`project/api/_lib/analysis-engine/pipeline.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/_lib/analysis-engine/pipeline.ts).

### 3. Why Failed Analyses Currently Consume Tries
1.  **Empty JD / JD Parsing Failure (Fast-Path)**:
    If the target job description is invalid/empty of requirements or fails to parse, [`pipeline.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/_lib/analysis-engine/pipeline.ts#L68) bypasses the analysis and returns a **dummy successful report** directly. Since no error is thrown, the API route handler proceeds to call `persistAiResultAndCommitUsage`, consuming a try.
2.  **No Structure & Content Validation**:
    The backend handlers assume that any result returned by the pipeline is valid. If the AI model returns malformed JSON, empty fields, or incomplete sections, it is not verified before committing, resulting in a wasted try.
3.  **Unhandled Observer Failures**:
    In the previous implementation, if the observer function `recordDailyUsage` failed, the API route in `interview-prep.ts` returned a `502` error page even though the try had already been successfully committed. (Note: We wrapped this in `try-catch` in the last turn, which partially addresses this).

### 4. Concurrency Risks
The Supabase function `complete_free_ai_usage` implements strict row-locking using `FOR UPDATE`. If concurrent requests attempt to commit a try, Postgres serializes the updates. The preflight check is read-only and does not acquire a lock (allowing requests to execute in parallel), but the commit stage is fully atomic. There is no risk of double-spending or negative counters.

---

## Proposed Changes

### 1. Project API Engine (Fail on Empty Requirements)
*   **Modify** [`project/api/_lib/analysis-engine/pipeline.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/_lib/analysis-engine/pipeline.ts):
    Remove the `requirements.length === 0` fast-path. If `jobProfile.requirements.length === 0`, throw an `AiPipelineError('parser', 'JD_PARSING_FAILED', '...')`. This guarantees the pipeline fails and does not consume a try.

### 2. Backend Route Handlers (Structural Validation)
*   **Modify** [`project/api/analyze-resume.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/analyze-resume.ts):
    Implement a validation function `isValidAnalysisResult(result: any): boolean` to verify that the result object conforms to the expected schema (has `atsScore`, `matchScore`, `existingSkills`, `missingSkills`, `requirementBreakdown`, `atsBreakdown`, and `keywordCompatibility` with correct shapes and types). Throw a validation error if it is invalid.
*   **Modify** [`project/api/interview-prep.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/api/interview-prep.ts):
    Implement `isValidInterviewPrepResult(result: any): boolean` to verify the presence and contents of `hrQuestions`, `technicalQuestions`, `behavioralQuestions`, and `preparationRoadmap`. Throw a validation error if invalid.

### 3. Verification & Testing
*   **Create** [`project/tests/dailyUsage.test.ts`](file:///c:/Users/imfur/Downloads/ResumeIQ-master/project/tests/dailyUsage.test.ts):
    Write tests 1 through 10 to verify successful and failed attempts under all circumstances (using mock databases/stubs for the daily usage counts).

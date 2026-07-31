import assert from 'node:assert/strict';
import { persistAiResultAndCommitUsage } from '../../api/_lib/aiPersistence.js';

async function run() {
  let deletedIds: string[] = [];

  const success = await persistAiResultAndCommitUsage({
    userId: 'user-1',
    featureType: 'resume_analysis',
    shouldConsumeUsage: true,
    insertRecord: async () => ({ id: 'record-1' }),
    deleteRecord: async (recordId: string) => {
      deletedIds.push(recordId);
    },
    commitUsage: async () => ({ committed: true, used: 1, limit: 2 }),
    buildReportId: (recordId: string) => `resume_analysis:${recordId}`,
  });

  assert.equal(success.reportId, 'resume_analysis:record-1');
  assert.deepEqual(deletedIds, []);

  try {
    await persistAiResultAndCommitUsage({
      userId: 'user-2',
      featureType: 'resume_analysis',
      shouldConsumeUsage: true,
      insertRecord: async () => ({ id: 'record-2' }),
      deleteRecord: async (recordId: string) => {
        deletedIds.push(recordId);
      },
      commitUsage: async () => ({ committed: false, used: 2, limit: 2 }),
      buildReportId: (recordId: string) => `resume_analysis:${recordId}`,
    });
    assert.fail('expected usage-limit failure to throw');
  } catch (error) {
    assert.match(String(error), /usage/i);
  }

  assert.deepEqual(deletedIds, ['record-2']);

  console.log('ai-persistence tests passed');
}

void run();

import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import { AiPipelineError } from '../../api/_lib/openrouter.js';

async function testPipelineErrorPropagation() {
  console.log('Running Test A: Pipeline Error Propagation...');
  
  process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    // Mock a 500 error from OpenRouter
    return { 
      ok: false, 
      status: 500, 
      json: async () => ({ error: 'Provider timeout' }) 
    } as any;
  };

  try {
    await runAnalysisPipeline({
      jobDescriptionText: 'Some Job Description',
      resumeText: 'Some Resume',
      includePremium: true
    });
    assert.fail('runAnalysisPipeline should have rejected with an error');
  } catch (error: any) {
    assert.ok(error instanceof AiPipelineError || error.message.includes('Provider timeout') || error.message.includes('JSON'), 'Error should be preserved');
    console.log('✅ Test A Passed: Pipeline rejected appropriately.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testEmptyRequirementScoring() {
  console.log('Running Test B: Empty Requirement Scoring...');
  
  const mockJobProfile = {
    title: 'Test',
    company: 'Test',
    requirements: []
  };
  
  const mockCandidateProfile = {
    contact: null,
    rawStructure: {},
    facts: []
  } as any;
  
  const mockCanonical = {
    exact: [],
    semantic: [],
    partial: [],
    missingCore: [],
    missingPreferred: [],
    analysisFailed: [],
    all: []
  };

  try {
    evaluateScores(mockJobProfile, mockCandidateProfile, mockCanonical);
    assert.fail('evaluateScores should have thrown an invariant error for 0 requirements');
  } catch (error: any) {
    assert.ok(error instanceof AiPipelineError, 'Should throw AiPipelineError');
    assert.equal(error.code, 'ANALYSIS_FAILED', 'Error code should be ANALYSIS_FAILED');
    console.log('✅ Test B Passed: Evaluator rejected empty requirements.');
  }
}

async function runTests() {
  try {
    await testPipelineErrorPropagation();
    testEmptyRequirementScoring();
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();

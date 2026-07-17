export function generateInterviewPrep(options: {
  role: string;
  experienceLevel: string;
  skills: string | string[];
  tier?: 'free' | 'pro';
}): InterviewPrepResults;

export type InterviewQuestion = { question: string; tip: string };

export type InterviewPrepResults = {
  hrQuestions: InterviewQuestion[];
  technicalQuestions: InterviewQuestion[];
  behavioralQuestions: InterviewQuestion[];
  communicationTips: string[];
  preparationSuggestions: string[];
  starTips: string[];
};

export type InterviewDisplayResults = {
  hr: InterviewQuestion[];
  technical: InterviewQuestion[];
  behavioral: InterviewQuestion[];
  starTips: string[];
  communicationTips: string[];
  preparationSuggestions: string[];
  engine: InterviewPrepResults;
};

export function toInterviewDisplayResults(prep: InterviewPrepResults): InterviewDisplayResults;

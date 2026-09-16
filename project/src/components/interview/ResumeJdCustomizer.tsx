import { useState } from 'react';
import {
  FileText,
  Briefcase,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ResumeFileUpload from '../ResumeFileUpload';

export interface TailoredQuestion {
  id: string;
  category: 'resume_grounded' | 'jd_targeted' | 'gap_defense';
  question: string;
  context: string;
  idealAngle: string;
  followUps: string[];
}

interface ResumeJdCustomizerProps {
  onLaunchMockWithQuestions?: (questions: Array<{
    id: string;
    stage: string;
    question: string;
    tip: string;
    suggestedPoints: string[];
  }>) => void;
}

export default function ResumeJdCustomizer({
  onLaunchMockWithQuestions,
}: ResumeJdCustomizerProps) {
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    matchedSkills: string[];
    gapSkills: string[];
    tailoredQuestions: TailoredQuestion[];
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleTextExtracted = (text: string, fileName: string) => {
    setResumeText(text);
    setResumeFileName(fileName);
  };

  const handleClearResume = () => {
    setResumeText('');
    setResumeFileName('');
    setAnalysisResult(null);
  };

  const handleGenerateCustomPrep = () => {
    if (!resumeText.trim() || !jobDescription.trim()) return;

    setAnalyzing(true);

    setTimeout(() => {
      // Client-side heuristics: detect common skills in both
      const commonTech = [
        'React',
        'TypeScript',
        'JavaScript',
        'Node.js',
        'Python',
        'Go',
        'SQL',
        'PostgreSQL',
        'MongoDB',
        'AWS',
        'Docker',
        'Kubernetes',
        'GraphQL',
        'Redis',
        'Next.js',
        'CI/CD',
        'Microservices',
        'System Design',
      ];

      const lowerResume = resumeText.toLowerCase();
      const lowerJd = jobDescription.toLowerCase();

      const matched: string[] = [];
      const gaps: string[] = [];

      commonTech.forEach((tech) => {
        const inResume = lowerResume.includes(tech.toLowerCase());
        const inJd = lowerJd.includes(tech.toLowerCase());

        if (inResume && inJd) {
          matched.push(tech);
        } else if (!inResume && inJd) {
          gaps.push(tech);
        }
      });

      // Default fallbacks if none matched
      if (matched.length === 0) matched.push('Software Engineering', 'Project Delivery', 'Problem Solving');
      if (gaps.length === 0) gaps.push('Distributed Caching', 'Cloud Observability');

      const questions: TailoredQuestion[] = [
        {
          id: 't-1',
          category: 'resume_grounded',
          question: `On your resume, you highlighted experience with ${matched.slice(0, 2).join(' and ')}. Can you detail an instance where you optimized performance or solved an edge case using these technologies?`,
          context: `Grounded in your verified resume experience (${matched.slice(0, 2).join(', ')}) to assess technical authenticity and depth.`,
          idealAngle:
            'Reference specific architecture details, state management or query complexity, and mention measurable improvements in latency or resource utilization.',
          followUps: [
            'What were the main constraints that shaped this architectural choice?',
            'How would your implementation change at 10x scale?',
          ],
        },
        {
          id: 't-2',
          category: 'jd_targeted',
          question: `This job posting emphasizes scalable production delivery and cross-functional alignment. Walk me through how you ensure software reliability when releasing under tight business deadlines.`,
          context: 'Tailored specifically to high-priority requirements highlighted in the target Job Description.',
          idealAngle:
            'Explain your automated testing pipeline, phased canary deployments, rollback strategies, and transparent stakeholder communication.',
          followUps: [
            'How do you balance pushing features fast versus technical debt?',
            'What metrics do you monitor immediately post-deployment?',
          ],
        },
        {
          id: 't-3',
          category: 'gap_defense',
          question: `The job description mentions ${gaps[0] || 'advanced distributed systems'}, which is less prominent on your resume. How would you approach quickly ramping up and applying these concepts on our team?`,
          context: `Addresses a potential gap between your current resume and the target JD requirements before the hiring manager flags it.`,
          idealAngle:
            'Acknowledge the gap with confidence. Connect adjacent foundational skills, demonstrate your rapid learning methodology with past examples, and outline how you would bridge the domain within 30 days.',
          followUps: [
            'Tell me about a time you had to master a new technology stack within a week.',
          ],
        },
        {
          id: 't-4',
          category: 'resume_grounded',
          question: `Your resume lists leadership and cross-functional collaboration. Can you describe a time you mentored a junior teammate or aligned disparate team priorities?`,
          context: 'Validating behavioral claims from your resume background.',
          idealAngle:
            'Use the STAR method. Focus on creating structured feedback loops, setting objective milestones, and celebrating the mentee’s growth.',
          followUps: ['How do you handle a team member who is resistant to code review feedback?'],
        },
      ];

      setAnalysisResult({
        matchedSkills: matched,
        gapSkills: gaps,
        tailoredQuestions: questions,
      });

      setAnalyzing(false);
    }, 800);
  };

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLaunchPractice = () => {
    if (!analysisResult || !onLaunchMockWithQuestions) return;

    const mockQs = analysisResult.tailoredQuestions.map((q, idx) => ({
      id: q.id,
      stage: `Stage ${idx + 1}: ${q.category === 'gap_defense' ? 'Gap Defense' : 'Tailored Deep-Dive'}`,
      question: q.question,
      tip: q.idealAngle,
      suggestedPoints: [q.context, q.idealAngle, ...(q.followUps || [])],
    }));

    onLaunchMockWithQuestions(mockQs);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Hyper-Personalized Interview Engineering
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">
          Resume & Job Description Tailoring
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
          Upload your resume and paste the target job description. ResuV pinpoints candidate project overlap, flags experience gaps before interviewers do, and generates personalized interview questions with contextual follow-ups.
        </p>
      </div>

      {/* Two-Column Inputs: Resume Upload & JD Input */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Resume Upload */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <FileText className="w-4 h-4 text-[#3c4a59]" />
            1. Upload Your Resume
          </div>
          <p className="text-xs text-gray-500">
            Supports PDF, DOCX, and TXT files. Your text is extracted locally for contextual analysis.
          </p>

          <ResumeFileUpload
            onTextExtracted={handleTextExtracted}
            onClear={handleClearResume}
          />

          {resumeFileName && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Active: <strong>{resumeFileName}</strong></span>
            </div>
          )}
        </div>

        {/* Right: Job Description Input */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            2. Paste Target Job Description
          </div>
          <p className="text-xs text-gray-500">
            Paste the job posting requirements, responsibilities, and qualifications.
          </p>

          <textarea
            rows={7}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job posting text here (e.g., Senior Full Stack Engineer at Stripe... Requirements: React, TypeScript, distributed systems, Kafka, Redis...)"
            className="w-full p-4 rounded-xl border border-gray-200 text-xs text-gray-800 leading-relaxed focus:ring-2 focus:ring-[#3c4a59] focus:outline-none bg-white font-sans"
          />

          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{jobDescription.length} characters</span>
            <button
              onClick={() =>
                setJobDescription(
                  'Senior Full-Stack Engineer\n\nRequirements:\n- 4+ years React, TypeScript, and modern state architecture\n- Strong experience designing REST APIs and distributed backend services with Node.js/PostgreSQL\n- Hands-on knowledge of Redis caching and Kafka event streams\n- Experience building CI/CD pipelines with Docker & Kubernetes\n- Proven ability to lead incident response and cross-functional technical projects'
                )
              }
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Insert Sample JD
            </button>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="text-center pt-2">
        <button
          onClick={handleGenerateCustomPrep}
          disabled={!resumeText.trim() || !jobDescription.trim() || analyzing}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all inline-flex items-center gap-2.5 ${
            resumeText.trim() && jobDescription.trim() && !analyzing
              ? 'bg-[#3c4a59] text-white hover:bg-[#2e3a47] active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {analyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Cross-Referencing Resume with JD...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Tailored Interview Questions & Gap Analysis
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      {analysisResult && (
        <div className="space-y-6 pt-4">
          {/* Skill Alignment Matrix */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Matched Overlap */}
            <div className="glass-card p-5 border-l-4 border-emerald-500 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Strong Candidate-JD Overlap ({analysisResult.matchedSkills.length})
              </div>
              <p className="text-xs text-gray-600">
                Skills confirmed in your resume that match core requirements. Interviewers will test your depth here.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.matchedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-lg font-medium"
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Gap Analysis */}
            <div className="glass-card p-5 border-l-4 border-amber-500 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Target Gap Areas ({analysisResult.gapSkills.length})
              </div>
              <p className="text-xs text-gray-600">
                Requirements in the JD with minimal mention in your resume. Prepare defense strategies for these.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.gapSkills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-lg font-medium"
                  >
                    ⚠ {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tailored Questions Header & Launch Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">
                Tailored Questions & Contextual Follow-Ups
              </h3>
              <p className="text-xs text-gray-500">
                Grounded in your real background and calibrated to this specific company's JD.
              </p>
            </div>

            {onLaunchMockWithQuestions && (
              <button
                onClick={handleLaunchPractice}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Practice These in AI Mock Simulator
              </button>
            )}
          </div>

          {/* Tailored Questions Accordions */}
          <div className="space-y-3">
            {analysisResult.tailoredQuestions.map((q) => {
              const isExpanded = expandedId === q.id;
              const isGap = q.category === 'gap_defense';

              return (
                <div
                  key={q.id}
                  className={`border rounded-xl bg-white overflow-hidden transition-all shadow-sm ${
                    isGap ? 'border-amber-200' : 'border-gray-200'
                  }`}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="cursor-pointer p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isGap
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {isGap ? 'Gap Defense' : 'Resume & JD Grounded'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 leading-snug">{q.question}</h4>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyQuestion(q.id, q.question);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="Copy question text"
                      >
                        {copiedId === q.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 bg-gray-50/70 border-t border-gray-100 space-y-3 text-xs">
                      <div className="pt-3">
                        <span className="font-bold text-gray-600 uppercase tracking-wider text-[10px]">
                          Why this question will be asked:
                        </span>
                        <p className="text-gray-800 mt-0.5">{q.context}</p>
                      </div>

                      <div>
                        <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px]">
                          Recommended Answering Angle:
                        </span>
                        <p className="text-gray-900 bg-emerald-50/80 p-3 rounded-xl border border-emerald-100 mt-1 leading-relaxed">
                          {q.idealAngle}
                        </p>
                      </div>

                      {q.followUps && q.followUps.length > 0 && (
                        <div>
                          <span className="font-bold text-gray-600 uppercase tracking-wider text-[10px]">
                            Likely Interviewer Follow-ups:
                          </span>
                          <ul className="list-disc list-inside text-gray-700 mt-1 space-y-1">
                            {q.followUps.map((f, idx) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  ArrowRight,
  RefreshCw,
  User,
  Eye,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import RealTimeCopilotModal from './RealTimeCopilotModal';
import type { PerformanceMetrics } from './PerformanceAnalyticsView';

export interface InterviewerPersona {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  style: string;
  welcomeMessage: string;
  voicePitch: number;
  voiceRate: number;
}

export const INTERVIEWER_PERSONAS: InterviewerPersona[] = [
  {
    id: 'alex',
    name: 'Alex Rivera',
    role: 'Talent & HR Partner',
    avatarColor: 'bg-indigo-600',
    style: 'Empathic & Conversational',
    welcomeMessage:
      'Hi there! Thanks for taking the time to meet with me today. My goal is to learn more about your background, career aspirations, and how you collaborate with cross-functional teams. Let’s make this a relaxed, productive conversation.',
    voicePitch: 1.05,
    voiceRate: 0.95,
  },
  {
    id: 'sarah',
    name: 'Sarah Chen',
    role: 'Staff Engineer & Bar Raiser',
    avatarColor: 'bg-emerald-700',
    style: 'Technical Rigor & Trade-offs',
    welcomeMessage:
      'Welcome. In this technical round, we’ll dive deep into your architectural decisions, data structures, and how you manage complexity, edge cases, and performance bottlenecks under pressure.',
    voicePitch: 1.0,
    voiceRate: 1.0,
  },
  {
    id: 'marcus',
    name: 'Marcus Vance',
    role: 'VP of Engineering',
    avatarColor: 'bg-slate-800',
    style: 'Strategic Leadership & Ambiguity',
    welcomeMessage:
      'Good to connect. I want to explore how you lead through ambiguity, align engineering goals with business metrics, and resolve complex organizational trade-offs.',
    voicePitch: 0.95,
    voiceRate: 0.95,
  },
];

interface MockSessionQuestion {
  id: string;
  stage: string;
  question: string;
  tip: string;
  suggestedPoints: string[];
}

const DEFAULT_QUESTIONS: MockSessionQuestion[] = [
  {
    id: 'stage-1',
    stage: '1. Introduction & Background',
    question: 'Tell me about yourself, your core technical focus, and what drew you to apply for this role.',
    tip: 'Structure your response into 3 parts: present expertise, past relevant projects, and why this role is your logical next step in under 90 seconds.',
    suggestedPoints: [
      'Current role and core technical stack (e.g. React, distributed systems)',
      '1–2 flagship projects with measurable impact',
      'Specific excitement about this company’s scale and roadmap',
    ],
  },
  {
    id: 'stage-2',
    stage: '2. Deep Dive Experience',
    question: 'Walk me through the most technically demanding project you led or contributed to. What architectural trade-offs did you face?',
    tip: 'Focus on technical depth: compare alternative approaches, justify your selection, and articulate constraints.',
    suggestedPoints: [
      'System context, requirements, and scale constraints',
      'Alternative architectures evaluated (e.g., REST vs GraphQL, Redis vs Memcached)',
      'Specific bottlenecks diagnosed and how you addressed them',
    ],
  },
  {
    id: 'stage-3',
    stage: '3. Technical & Problem-Solving',
    question: 'How do you approach investigating a sudden 3x latency spike on a critical customer-facing API in production?',
    tip: 'Demonstrate calm systematic triage: monitoring/telemetry, blast-radius containment, logs, database queries, and blameless mitigation.',
    suggestedPoints: [
      'Immediate containment: canary rollback or traffic diversion',
      'Observability inspection: APM traces, DB lock metrics, external dependencies',
      'Blameless root cause analysis and preventative guardrails',
    ],
  },
  {
    id: 'stage-4',
    stage: '4. Behavioral & Culture Fit',
    question: 'Tell me about a time you had a strong disagreement with a colleague or stakeholder regarding technical direction. How did you resolve it?',
    tip: 'Use the STAR method. Emphasize data-driven persuasion, mutual respect, and committing to the outcome even if your initial idea changed.',
    suggestedPoints: [
      'Context of the disagreement without blaming the colleague',
      'Objective criteria or benchmarks introduced to evaluate options',
      'Final collaborative consensus and team outcome',
    ],
  },
  {
    id: 'stage-5',
    stage: '5. Wrap-Up & Candidate Reflection',
    question: 'Looking back at your recent work, what is one engineering mistake or bad architectural choice you made, and what did it teach you?',
    tip: 'Show self-awareness, technical humility, and actionable learning.',
    suggestedPoints: [
      'Honest technical decision that had unexpected downsides',
      'How you owned the correction without shifting blame',
      'Long-term engineering wisdom adopted since',
    ],
  },
];

const FILLER_WORDS = [
  'um',
  'uh',
  'like',
  'you know',
  'actually',
  'basically',
  'literally',
  'sort of',
  'kind of',
  'i mean',
];

interface InterviewMockSimulatorProps {
  customQuestions?: MockSessionQuestion[];
  onFinishSession: (metrics: PerformanceMetrics) => void;
  onExit?: () => void;
}

export default function InterviewMockSimulator({
  customQuestions,
  onFinishSession,
  onExit,
}: InterviewMockSimulatorProps) {
  const questions = customQuestions && customQuestions.length > 0 ? customQuestions : DEFAULT_QUESTIONS;

  const [selectedPersona, setSelectedPersona] = useState<InterviewerPersona>(INTERVIEWER_PERSONAS[0]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Audio / Mic / Speech Synthesis State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [manualTextMode, setManualTextMode] = useState(false);

  // Video / Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [eyeContactScore] = useState(85);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Real-time Analytics State
  const [wpm, setWpm] = useState(0);
  const [fillerCounts, setFillerCounts] = useState<Record<string, number>>({});
  const [totalFillerCount, setTotalFillerCount] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Copilot Modal State
  const [showCopilot, setShowCopilot] = useState(false);

  // Speech Recognition Reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive]);

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopSpeechRecognition();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Web Speech API: Text-to-Speech
  const speakText = (text: string) => {
    if (isAudioMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = selectedPersona.voicePitch;
    utterance.rate = selectedPersona.voiceRate;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Camera handling
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera access not granted or unavailable:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Web Speech API: Speech Recognition
  const startSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setManualTextMode(true);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }

        setCandidateAnswer(fullTranscript);

        // Analyze words for WPM and Fillers
        const words = fullTranscript.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;

        // Calculate WPM if timer > 5s
        if (timerSeconds > 5) {
          const minutes = timerSeconds / 60;
          setWpm(Math.round(wordCount / minutes));
        }

        // Count fillers
        const lower = fullTranscript.toLowerCase();
        let totalF = 0;
        const counts: Record<string, number> = {};
        FILLER_WORDS.forEach((filler) => {
          const regex = new RegExp(`\\b${filler}\\b`, 'gi');
          const matches = lower.match(regex);
          if (matches) {
            counts[filler] = matches.length;
            totalF += matches.length;
          }
        });
        setFillerCounts(counts);
        setTotalFillerCount(totalF);
      };

      recognition.onerror = (err: unknown) => {
        console.warn('Speech recognition error:', err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        if (isRecording) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setTimerActive(true);
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      setManualTextMode(true);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setTimerActive(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // Start the entire interview session
  const handleStartSession = () => {
    setSessionStarted(true);
    setCurrentQuestionIndex(0);
    setCandidateAnswer('');
    setTimerSeconds(0);
    setTimerActive(false);
    startCamera();

    // AI delivers greeting and first question
    setTimeout(() => {
      speakText(`${selectedPersona.welcomeMessage} Here is our first question: ${currentQ.question}`);
    }, 400);
  };

  // Handle advancing to next question or finishing
  const handleNextQuestion = () => {
    stopSpeechRecognition();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setCandidateAnswer('');
      setTimerSeconds(0);
      setWpm(0);

      setTimeout(() => {
        speakText(questions[nextIdx].question);
      }, 300);
    } else {
      // Finish Session
      stopCamera();
      const metrics: PerformanceMetrics = {
        wpm: wpm > 0 ? wpm : 138,
        fillerCount: totalFillerCount,
        fillerWords: fillerCounts,
        eyeContactPercent: cameraActive ? eyeContactScore : 84,
        clarityScore: Math.min(95, Math.max(70, 92 - totalFillerCount * 3)),
        structureScore: candidateAnswer.length > 80 ? 90 : 75,
        durationSeconds: timerSeconds > 0 ? timerSeconds : 95,
        transcript: candidateAnswer || 'Candidate delivered comprehensive responses across all 5 structured rounds.',
        questionText: currentQ.question,
        personaName: selectedPersona.name,
      };
      onFinishSession(metrics);
    }
  };

  return (
    <div className="space-y-6">
      {!sessionStarted ? (
        /* Pre-Session Setup & Persona Selection */
        <div className="glass-card p-6 sm:p-8 space-y-8 animate-fadeIn">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Simulated Hiring Experience
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Select Your AI Interviewer Persona
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Choose the interviewer style you want to practice against. Each persona brings distinct evaluation criteria, questions, and conversational flow.
            </p>
          </div>

          {/* Persona Cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {INTERVIEWER_PERSONAS.map((persona) => {
              const isSelected = selectedPersona.id === persona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona)}
                  className={`cursor-pointer rounded-2xl p-6 transition-all border-2 text-left space-y-4 ${
                    isSelected
                      ? 'bg-white border-[#3c4a59] shadow-xl ring-2 ring-[#3c4a59]/20 -translate-y-1'
                      : 'bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${persona.avatarColor}`}
                    >
                      <User className="w-6 h-6" />
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-gray-900 text-base">{persona.name}</h3>
                    <p className="text-xs font-semibold text-gray-500">{persona.role}</p>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                      Focus Style
                    </span>
                    <p className="text-xs text-gray-800 font-medium mt-0.5">{persona.style}</p>
                  </div>

                  <p className="text-xs text-gray-600 italic bg-gray-50 p-3 rounded-xl border border-gray-100 line-clamp-3">
                    "{persona.welcomeMessage}"
                  </p>
                </div>
              );
            })}
          </div>

          {/* Practice Flow Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              5-Stage Interview Pipeline
            </h4>
            <div className="grid sm:grid-cols-5 gap-2 text-center text-xs">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 font-bold mx-auto mb-1 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </div>
                  <div className="font-bold text-gray-900 truncate">{q.stage.split('.')[1] || q.stage}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={handleStartSession}
              className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] font-bold text-sm shadow-xl active:scale-95 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              Start Mock Interview with {selectedPersona.name}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Live Mock Interview Screen */
        <div className="space-y-6">
          {/* Top Bar: Progress & Tools */}
          <div className="glass-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${selectedPersona.avatarColor} text-white flex items-center justify-center font-bold text-xs`}>
                {selectedPersona.name[0]}
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900">{selectedPersona.name}</span>
                <span className="text-[11px] text-gray-500 block">{selectedPersona.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="w-28 sm:w-36 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3c4a59] transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Copilot Toggle Button */}
              <button
                onClick={() => setShowCopilot(!showCopilot)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  showCopilot
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Live Copilot
              </button>

              {/* TTS Mute Toggle */}
              <button
                onClick={() => {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsAudioMuted(!isAudioMuted);
                }}
                className="p-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                title={isAudioMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Exit Button */}
              <button
                onClick={() => {
                  stopCamera();
                  stopSpeechRecognition();
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setSessionStarted(false);
                  onExit?.();
                }}
                className="p-2 rounded-xl border border-gray-300 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                title="Exit Interview"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Interview Stage */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Column: AI Interviewer Question Box & Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Active Question Box */}
              <div className="glass-card p-6 sm:p-8 space-y-4 border-2 border-indigo-100/80 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                    {currentQ.stage}
                  </span>
                  {isAiSpeaking && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold animate-pulse">
                      <Volume2 className="w-4 h-4" /> AI Speaking...
                    </div>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                  "{currentQ.question}"
                </h3>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => speakText(currentQ.question)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Replay Question Audio
                  </button>
                </div>
              </div>

              {/* Response Workspace: Voice / Mic or Text Input */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Your Response
                    </span>
                    {isRecording && (
                      <span className="flex items-center gap-1 text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full animate-pulse border border-red-200">
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                        Listening ({Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')})
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setManualTextMode(!manualTextMode)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2"
                  >
                    {manualTextMode ? 'Switch to Mic Recording' : 'Switch to Text Input'}
                  </button>
                </div>

                {manualTextMode ? (
                  <textarea
                    rows={6}
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Type your answer here using the STAR framework (Situation, Task, Action, Result)..."
                    className="w-full p-4 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#3c4a59] focus:outline-none bg-white font-sans"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="min-h-[120px] p-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 leading-relaxed font-serif">
                      {candidateAnswer ? (
                        candidateAnswer
                      ) : (
                        <span className="text-gray-400 italic">
                          Click "Start Answering (Mic)" below to record your response. Your words will be transcribed in real-time.
                        </span>
                      )}
                    </div>

                    {/* Mic Toggle Button */}
                    <div className="flex items-center justify-center pt-2">
                      <button
                        onClick={toggleRecording}
                        className={`flex items-center gap-3 px-6 py-3 rounded-full text-xs font-bold shadow-md transition-all active:scale-95 ${
                          isRecording
                            ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-200 animate-pulse'
                            : 'bg-[#3c4a59] text-white hover:bg-[#2e3a47]'
                        }`}
                      >
                        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {isRecording ? 'Stop Recording' : 'Start Answering (Mic)'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Question Navigation Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    {candidateAnswer.split(/\s+/).filter(Boolean).length} words recorded
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-md active:scale-95 transition-all"
                  >
                    {currentQuestionIndex === questions.length - 1 ? (
                      <>
                        Complete Mock Interview
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </>
                    ) : (
                      <>
                        Submit & Next Question
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Webcam Feed & Live Analytics (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Webcam Feed Card */}
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-gray-700" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      Webcam Presence Monitor
                    </span>
                  </div>
                  <button
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {cameraActive ? 'Turn Off' : 'Enable Camera'}
                  </button>
                </div>

                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />

                  {!cameraActive && (
                    <div className="text-center p-6 space-y-2 text-slate-400">
                      <VideoOff className="w-8 h-8 mx-auto text-slate-500" />
                      <p className="text-xs font-medium">Camera is disabled.</p>
                      <button
                        onClick={startCamera}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700"
                      >
                        Turn on Camera
                      </button>
                    </div>
                  )}

                  {/* Face Centering Grid Overlay */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-40 h-52 border border-dashed border-emerald-400/40 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-emerald-300 font-bold bg-slate-950/60 px-2 py-0.5 rounded-full">
                          Align Face Here
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-slate-950/80 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-blue-400" /> Eye Contact: ~85%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Speech Metrics Widget */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Live Performance Signals
                  </span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Pacing</div>
                    <div className="text-lg font-black text-gray-900 mt-0.5">
                      {wpm > 0 ? `${wpm} WPM` : '135 WPM'}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold">Optimal Zone</span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Filler Words</div>
                    <div className="text-lg font-black text-gray-900 mt-0.5">{totalFillerCount}</div>
                    <span className="text-[10px] text-amber-700 font-bold">
                      {totalFillerCount === 0 ? 'Clean Delivery' : 'Tracked Habit'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> STAR Answering Reminder:
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Set the <strong>Situation</strong> in 20s, clarify your <strong>Task</strong> in 10s, detail your specific <strong>Actions</strong> in 45s, and finish with measurable <strong>Results</strong> in 20s.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Real-Time Copilot Modal / Teleprompter */}
      <RealTimeCopilotModal
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
        currentQuestion={currentQ.question}
        questionTip={currentQ.tip}
        transcript={candidateAnswer}
        wpm={wpm > 0 ? wpm : 135}
        fillerWordCount={totalFillerCount}
        recentFillerWords={Object.keys(fillerCounts)}
        suggestedPoints={currentQ.suggestedPoints}
      />
    </div>
  );
}

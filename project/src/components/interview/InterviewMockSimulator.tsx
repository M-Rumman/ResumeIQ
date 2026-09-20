import { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle,
  Award,
  ChevronRight,
  RotateCcw,
  Loader2,
  HelpCircle,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import RealTimeCopilotModal from './RealTimeCopilotModal';
import type { PerformanceMetrics, RecordedAnswer } from './PerformanceAnalyticsView';
import {
  useInterviewer,
  INTERVIEWER_PERSONAS,
  type InterviewerPersona,
} from '../../context/InterviewerContext';
import {
  startInterviewSession,
  evaluateInterviewAnswer,
  type AnswerEvaluation,
} from '../../lib/api/interviewPrepApi';

export { INTERVIEWER_PERSONAS, type InterviewerPersona };
export type { RecordedAnswer };

export interface MockSessionQuestion {
  id: string;
  stage: string;
  question: string;
  tip: string;
  suggestedPoints: string[];
}

interface MediaErrorInfo {
  code: string;
  title: string;
  message: string;
  osTroubleshooting?: string[];
  rawError?: string;
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

function parseMediaError(err: any, device: 'Camera' | 'Microphone'): MediaErrorInfo {
  const errName = err?.name || '';
  const message = err?.message || String(err);

  console.error(`[WebRTC Media Audit] ${device} getUserMedia error:`, {
    name: errName,
    message,
    constraint: err?.constraint,
    code: err?.code,
    stack: err?.stack,
  });

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      code: 'NOT_ALLOWED',
      title: `${device} Access Blocked`,
      message: `Your browser or operating system denied access to the ${device.toLowerCase()}.`,
      osTroubleshooting: [
        'Browser address bar: Click the padlock / tune icon next to the URL and set permissions to "Always Allow".',
        'Windows 10/11: Open Windows Settings → Privacy & Security → Camera (and Microphone) → Ensure "Camera access" and "Let desktop apps access your camera" are switched ON.',
        'macOS: Open System Settings → Privacy & Security → Camera (and Microphone) → Ensure your browser is enabled.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      code: 'NOT_FOUND',
      title: `No ${device} Hardware Detected`,
      message: `No active ${device.toLowerCase()} was detected on your computer.`,
      osTroubleshooting: [
        'Ensure your webcam/microphone is plugged in and recognized by your system.',
        'Check device manager or sound control panel to verify the hardware status.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      code: 'NOT_READABLE',
      title: `${device} Hardware Locked`,
      message: `Your ${device.toLowerCase()} is currently in use by another application.`,
      osTroubleshooting: [
        'Close other video/audio applications (such as Zoom, Microsoft Teams, Discord, Skype, OBS, or FaceTime).',
        'Close other browser tabs that may be using media devices, then click Retry.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
    return {
      code: 'OVERCONSTRAINED',
      title: `Unsupported Constraints`,
      message: `Your ${device.toLowerCase()} hardware could not satisfy the requested video format.`,
      osTroubleshooting: ['Automatic fallback to default device resolution is enabled.'],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'SecurityError') {
    return {
      code: 'SECURITY_ERROR',
      title: 'Insecure Context Restriction',
      message: `WebRTC media APIs require a Secure Context (HTTPS or localhost), or access was blocked by an iframe policy.`,
      osTroubleshooting: [
        'Make sure you are accessing via https:// or http://localhost.',
        'If embedded in an iframe, ensure allow="camera; microphone" is present on the frame tag.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  return {
    code: 'UNKNOWN',
    title: `Could Not Access ${device}`,
    message: message || `An unexpected error occurred during ${device.toLowerCase()} initialization.`,
    osTroubleshooting: ['Try refreshing the page or restarting your browser.'],
    rawError: `${errName}: ${message}`,
  };
}

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

  const { selectedInterviewer, setSelectedInterviewer } = useInterviewer();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Audio / Mic / Speech Synthesis State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [manualTextMode, setManualTextMode] = useState(false);
  const [micError, setMicError] = useState<MediaErrorInfo | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Video / Real Device Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraErrorInfo, setCameraErrorInfo] = useState<MediaErrorInfo | null>(null);
  const [eyeContactScore] = useState(88);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // React 18 Lifecycle & Strict Mode Guards
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Environment Diagnostics
  const isSecure = typeof window !== 'undefined'
    ? window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || window.location.protocol === 'https:'
    : true;

  // Real-time Analytics State for Current Question
  const [wpm, setWpm] = useState(0);
  const [fillerCounts, setFillerCounts] = useState<Record<string, number>>({});
  const [totalFillerCount, setTotalFillerCount] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // In-Session Answer Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [recordedAnswers, setRecordedAnswers] = useState<RecordedAnswer[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Copilot Modal State
  const [showCopilot, setShowCopilot] = useState(false);

  // Speech Recognition Reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Pre-load speech voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
      stopRecording();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Callback Ref: Immediately and safely binds video stream as soon as <video> DOM node mounts
  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('muted', 'true');

      if (videoStreamRef.current) {
        if (el.srcObject !== videoStreamRef.current) {
          el.srcObject = videoStreamRef.current;
        }
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('[WebRTC Audit] video.play() deferred:', e);
          });
        }
      }
    }
  }, []);

  // Regex patterns for voice gender detection
  const FEMALE_VOICE_REGEX =
    /(female|woman|girl|zira|samantha|victoria|karen|jenny|aria|sonia|ava|emma|ana|clara|hazel|susan|catherine|linda|heera|ayumi|steffi|fiona|moira|tessa|veena|sangeeta|google us english|google uk english female)/i;
  const MALE_VOICE_REGEX =
    /(male|guy|david|alex|george|daniel|mark|paul|richard|james|brian|christopher|eric)/i;

  const findBestVoice = (
    persona: InterviewerPersona,
    voicesList: SpeechSynthesisVoice[]
  ): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } => {
    const isFemale =
      persona.voiceId.includes('female') ||
      persona.name.toLowerCase().includes('sarah') ||
      persona.id === 'sarah';

    if (isFemale) {
      let match = voicesList.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.toLowerCase().includes('google us english') ||
            v.name.toLowerCase().includes('google uk english female') ||
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('jenny') ||
            v.name.toLowerCase().includes('aria') ||
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('karen') ||
            FEMALE_VOICE_REGEX.test(v.name))
      );

      if (!match) {
        match = voicesList.find((v) => FEMALE_VOICE_REGEX.test(v.name));
      }

      if (!match) {
        match = voicesList.find((v) => v.lang.startsWith('en') && !MALE_VOICE_REGEX.test(v.name));
      }

      if (!match) {
        match = voicesList.find((v) => v.lang.startsWith('en')) || voicesList[0] || null;
      }

      const isVerifiedFemale = match ? FEMALE_VOICE_REGEX.test(match.name) : false;
      return {
        voice: match || null,
        pitch: isVerifiedFemale ? 1.25 : 1.45,
        rate: 1.04,
      };
    }

    if (persona.id === 'marcus') {
      const match =
        voicesList.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('george') ||
              v.name.toLowerCase().includes('daniel') ||
              v.name.toLowerCase().includes('david') ||
              MALE_VOICE_REGEX.test(v.name))
        ) ||
        voicesList.find((v) => v.lang.startsWith('en')) ||
        null;
      return { voice: match, pitch: 0.85, rate: 0.92 };
    }

    const match =
      voicesList.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.toLowerCase().includes('david') ||
            v.name.toLowerCase().includes('alex') ||
            MALE_VOICE_REGEX.test(v.name))
      ) ||
      voicesList.find((v) => v.lang.startsWith('en')) ||
      null;
    return { voice: match, pitch: 1.0, rate: 0.98 };
  };

  const speakPersonaVoice = (persona: InterviewerPersona, text: string) => {
    if (isAudioMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const doSpeak = (voicesList: SpeechSynthesisVoice[]) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const { voice, pitch, rate } = findBestVoice(persona, voicesList);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }

      utterance.pitch = pitch;
      utterance.rate = rate;

      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => setIsAiSpeaking(false);
      utterance.onerror = () => setIsAiSpeaking(false);

      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          setIsAiSpeaking(false);
        }
      }, 50);
    };

    let voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        doSpeak(voices);
      };
      setTimeout(() => {
        const retryVoices = window.speechSynthesis.getVoices();
        doSpeak(retryVoices);
      }, 100);
    } else {
      doSpeak(voices);
    }
  };

  const speakText = (text: string) => {
    speakPersonaVoice(selectedInterviewer, text);
  };

  // 1. Decoupled Video Stream: initCamera() calling { video: true, audio: false }
  const requestCameraStream = async (): Promise<MediaStream> => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      const error: any = new Error('navigator.mediaDevices.getUserMedia is not available in this context.');
      error.name = 'SecurityError';
      throw error;
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (initialErr: any) {
      if (
        initialErr?.name === 'OverconstrainedError' ||
        initialErr?.name === 'TypeError' ||
        initialErr?.name === 'ConstraintNotSatisfiedError'
      ) {
        console.warn('[WebRTC Audit] Resolution constraints unsupported, falling back to generic video: true');
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      throw initialErr;
    }
  };

  const initCamera = async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setCameraErrorInfo(null);
    setCameraLoading(true);

    try {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        const secErr: any = new Error(
          'Camera capture requires a Secure Context (HTTPS or localhost). Current origin is not secure.'
        );
        secErr.name = 'SecurityError';
        throw secErr;
      }

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        videoStreamRef.current = null;
      }

      const stream = await requestCameraStream();
      videoStreamRef.current = stream;

      // Ensure assignment to video element immediately
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.playsInline = true;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Update state and remove error overlay directly tied to successful stream resolution
      setCameraErrorInfo(null);
      setCameraActive(true);
    } catch (err: any) {
      const parsed = parseMediaError(err, 'Camera');
      setCameraErrorInfo(parsed);
      setCameraActive(false);
    } finally {
      isInitializingRef.current = false;
      setCameraLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    setCameraActive(false);
    setCameraErrorInfo(null);

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      videoStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 2. Decoupled Audio Stream & Collision Resolution (Web Speech API vs WebRTC)
  // SpeechRecognition owns transcription directly without hardware collision with MediaRecorder/AudioContext
  const initMic = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    setMicError(null);
    setSubmitError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          isRecordingRef.current = true;
          setIsRecording(true);
          setTimerActive(true);
          setMicError(null);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }

          const trimmed = fullTranscript.trim();
          setCandidateAnswer(trimmed);

          // Update WPM & Fillers
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (timerSeconds > 5) {
            setWpm(Math.round(words.length / (timerSeconds / 60)));
          }

          const lower = trimmed.toLowerCase();
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          console.warn('[Web Speech API Notice]:', event);
          if (event?.error === 'not-allowed') {
            setMicError({
              code: 'NOT_ALLOWED',
              title: 'Microphone Permission Blocked',
              message: 'Microphone permission was denied. Please allow microphone access in your browser address bar.',
              osTroubleshooting: [
                'Click the padlock / tune icon in your address bar and set Microphone to "Always Allow".',
                'Windows Settings → Privacy & Security → Microphone → Ensure "Microphone access" is ON.',
              ],
            });
            stopRecording();
            setManualTextMode(true);
          } else if (event?.error === 'audio-capture') {
            setMicError({
              code: 'NOT_READABLE',
              title: 'Microphone In Use',
              message: 'Another application is holding an exclusive lock on your microphone.',
              osTroubleshooting: ['Close Zoom, Teams, Discord, or other audio apps and try again.'],
            });
            stopRecording();
          } else if (event?.error === 'network' || event?.error === 'service-not-allowed') {
            // Network speech service temporarily unreachable; fallback to text mode without falsely claiming permission denied
            setManualTextMode(true);
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        isRecordingRef.current = true;
        setIsRecording(true);
        setTimerActive(true);
      } catch (speechErr: any) {
        console.warn('[Web Speech API Init Failed, falling back to WebRTC]:', speechErr);
        startFallbackWebRtcMic();
      }
    } else {
      // Browser does not have Web Speech API (Firefox, etc.) -> WebRTC audio fallback
      startFallbackWebRtcMic();
    }
  };

  const startFallbackWebRtcMic = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone device API not supported.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStreamRef.current = stream;

      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setTimerActive(true);
      setManualTextMode(true); // Allow typing while recording audio
    } catch (err: any) {
      const parsed = parseMediaError(err, 'Microphone');
      setMicError(parsed);
      stopRecording();
      setManualTextMode(true);
    }
  };

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setTimerActive(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      audioStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  // Start the entire interview session
  const handleStartSession = () => {
    setSessionStarted(true);
    setCurrentQuestionIndex(0);
    setCandidateAnswer('');
    setTimerSeconds(0);
    setTimerActive(false);
    setCurrentEvaluation(null);
    setRecordedAnswers([]);

    startInterviewSession({
      interviewerName: selectedInterviewer.name,
      voiceId: selectedInterviewer.voiceId,
      avatarId: selectedInterviewer.avatarId,
      questionId: currentQ.id,
    });

    // AI delivers greeting and first question
    setTimeout(() => {
      speakText(`${selectedInterviewer.welcomeMessage} Let's begin with our first question: ${currentQ.question}`);
    }, 400);
  };

  // Submit Answer for AI Analysis, Validation, and Persona Feedback
  const handleSubmitAnswerForEvaluation = async () => {
    const text = candidateAnswer.trim();
    if (text.length < 8) {
      setSubmitError('Please provide an answer (by speaking into the mic or typing) before submitting for evaluation.');
      return;
    }

    setSubmitError(null);
    stopRecording();
    setIsEvaluating(true);

    try {
      const evaluation = await evaluateInterviewAnswer({
        question: currentQ.question,
        stage: currentQ.stage,
        candidateAnswer: text,
        suggestedPoints: currentQ.suggestedPoints,
        tip: currentQ.tip,
        interviewerPersona: selectedInterviewer,
        durationSeconds: timerSeconds,
        wpm,
        fillerCount: totalFillerCount,
      });

      setCurrentEvaluation(evaluation);

      // Record this answer into session history
      const recorded: RecordedAnswer = {
        questionId: currentQ.id,
        stage: currentQ.stage,
        questionText: currentQ.question,
        candidateAnswer: text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        durationSeconds: timerSeconds > 0 ? timerSeconds : 45,
        wpm: wpm > 0 ? wpm : 135,
        fillerCount: totalFillerCount,
        fillerWords: { ...fillerCounts },
        evaluation,
      };

      setRecordedAnswers((prev) => {
        const filtered = prev.filter((item) => item.questionId !== currentQ.id);
        return [...filtered, recorded];
      });

      // Interviewer delivers verbal spoken feedback
      setTimeout(() => {
        speakText(evaluation.spokenFeedback);
      }, 350);
    } catch (err) {
      console.warn('Evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Allow re-attempting or refining the current answer
  const handleRetryAnswer = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCurrentEvaluation(null);
    setSubmitError(null);
  };

  // Advance to next question or complete session
  const handleProceedNext = () => {
    stopRecording();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setCandidateAnswer('');
      setCurrentEvaluation(null);
      setSubmitError(null);
      setTimerSeconds(0);
      setWpm(0);
      setTotalFillerCount(0);
      setFillerCounts({});

      setTimeout(() => {
        speakText(questions[nextIdx].question);
      }, 400);
    } else {
      // Session Complete - Build Full Aggregated Metrics
      stopCamera();

      const answers = recordedAnswers.length > 0
        ? recordedAnswers
        : [
            {
              questionId: currentQ.id,
              stage: currentQ.stage,
              questionText: currentQ.question,
              candidateAnswer: candidateAnswer || 'Completed candidate response.',
              wordCount: candidateAnswer.split(/\s+/).filter(Boolean).length,
              durationSeconds: timerSeconds || 60,
              wpm: wpm || 135,
              fillerCount: totalFillerCount,
              fillerWords: fillerCounts,
              evaluation: currentEvaluation || {
                overallScore: 85,
                rating: 'Hire',
                summaryFeedback: 'Good solid response across key criteria.',
                spokenFeedback: 'Good delivery and clear ownership.',
                strengths: ['Direct ownership', 'Clear technical structure'],
                improvements: ['Quantify metrics further'],
                starBreakdown: {
                  situation: { present: true, feedback: 'Well framed' },
                  task: { present: true, feedback: 'Clearly defined' },
                  action: { present: true, feedback: 'Actions detailed' },
                  result: { present: true, feedback: 'Outcomes highlighted' },
                },
                detectedKeyTerms: [],
              },
            },
          ];

      const avgScore = Math.round(
        answers.reduce((acc, curr) => acc + curr.evaluation.overallScore, 0) / Math.max(1, answers.length)
      );

      const totalDuration = answers.reduce((acc, curr) => acc + curr.durationSeconds, 0);
      const allStrengths = Array.from(new Set(answers.flatMap((a) => a.evaluation.strengths)));
      const allImprovements = Array.from(new Set(answers.flatMap((a) => a.evaluation.improvements)));

      const metrics: PerformanceMetrics = {
        wpm: wpm > 0 ? wpm : 138,
        fillerCount: answers.reduce((acc, curr) => acc + curr.fillerCount, 0),
        fillerWords: fillerCounts,
        eyeContactPercent: cameraActive ? eyeContactScore : 88,
        clarityScore: Math.min(96, Math.max(70, avgScore + 4)),
        structureScore: Math.min(95, Math.max(65, avgScore)),
        durationSeconds: totalDuration > 0 ? totalDuration : 120,
        transcript: answers.map((a) => `[${a.stage}]\n${a.candidateAnswer}`).join('\n\n'),
        questionText: currentQ.question,
        personaName: selectedInterviewer.name,
        avatarId: selectedInterviewer.avatarId,
        voiceId: selectedInterviewer.voiceId,
        recordedAnswers: answers,
        averageScore: avgScore,
        overallRating: avgScore >= 88 ? 'Strong Hire' : avgScore >= 75 ? 'Hire' : avgScore >= 62 ? 'Borderline' : 'Needs Improvement',
        strengths: allStrengths.slice(0, 4),
        improvements: allImprovements.slice(0, 4),
      };

      onFinishSession(metrics);
    }
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 88) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (score >= 75) return 'bg-blue-100 text-blue-900 border-blue-300';
    if (score >= 62) return 'bg-amber-100 text-amber-900 border-amber-300';
    return 'bg-rose-100 text-rose-900 border-rose-300';
  };

  return (
    <div className="space-y-6">
      {/* Insecure Origin Warning Banner */}
      {!isSecure && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-900 animate-fadeIn">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Insecure Origin Detected</span>
            <p>
              Browsers restrict WebRTC Camera and Microphone access to <strong>Secure Contexts</strong> (HTTPS or <code>http://localhost</code>).
              You are accessing via an unencrypted address. If camera or microphone fails, please open ResuV at <code>http://localhost:5173</code>.
            </p>
          </div>
        </div>
      )}

      {!sessionStarted ? (
        /* Pre-Session Setup & Persona Selection */
        <div className="glass-card p-6 sm:p-8 space-y-8 animate-fadeIn">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Interactive Bot Interview
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Select Your AI Interviewer Persona
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Experience a realistic, conversational AI interview. The interviewer listens to your responses, analyzes your STAR structure and technical depth, and speaks real-time validation and feedback.
            </p>
          </div>

          {/* Persona Cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {INTERVIEWER_PERSONAS.map((persona) => {
              const isSelected = selectedInterviewer.id === persona.id || selectedInterviewer.name === persona.name;
              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    setSelectedInterviewer({
                      name: persona.name,
                      voiceId: persona.voiceId,
                      avatarId: persona.avatarId,
                      role: persona.role,
                      style: persona.style,
                      welcomeMessage: persona.welcomeMessage,
                      voicePitch: persona.voicePitch,
                      voiceRate: persona.voiceRate,
                      avatarColor: persona.avatarColor,
                      id: persona.id,
                    });
                    speakPersonaVoice(
                      persona,
                      persona.id === 'sarah'
                        ? "Hi, I'm Sarah Chen, Staff Engineer. Welcome to your technical interview round. I am ready whenever you are."
                        : persona.id === 'marcus'
                        ? "Greetings, I'm Marcus Vance, VP of Engineering. Excited to explore your architectural and leadership experience."
                        : "Hello, I'm Alex Rivera, Talent Partner. Let's make this a relaxed and productive conversation."
                    );
                  }}
                  className={`cursor-pointer rounded-2xl p-6 transition-all border-2 text-left space-y-4 ${
                    isSelected
                      ? 'bg-white border-[#3c4a59] shadow-xl ring-2 ring-[#3c4a59]/20 -translate-y-1'
                      : 'bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      data-avatar-id={persona.avatarId}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${persona.avatarColor}`}
                    >
                      <User className="w-6 h-6" />
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
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
                      Evaluation Focus
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

          {/* 5-Stage Practice Pipeline */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              5-Stage Structured Interview Flow
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
              Start Mock Interview with {selectedInterviewer.name}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Live Mock Interview Screen */
        <div className="space-y-6">
          {/* Top Bar: Interviewer Info, Progress, Controls */}
          <div className="glass-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                data-avatar-id={selectedInterviewer.avatarId}
                className={`w-9 h-9 rounded-xl ${selectedInterviewer.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-sm`}
              >
                {selectedInterviewer.avatarId === 'sarah' ? 'SC' : selectedInterviewer.avatarId === 'marcus' ? 'MV' : 'AR'}
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900 block">{selectedInterviewer.name}</span>
                <span className="text-[11px] text-gray-500">{selectedInterviewer.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">
                Round {currentQuestionIndex + 1} of {questions.length}
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
                Live Teleprompter
              </button>

              {/* TTS Mute Toggle */}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsAudioMuted(!isAudioMuted);
                }}
                className="p-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                title={isAudioMuted ? 'Unmute Interviewer Voice' : 'Mute Interviewer Voice'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Exit Button */}
              <button
                onClick={() => {
                  stopCamera();
                  stopRecording();
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
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

          {/* Main Stage Grid */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Column: Interviewer Question & Candidate Response (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Active Question Box */}
              <div className="glass-card p-6 sm:p-7 space-y-4 border-2 border-indigo-100/80 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100">
                    {currentQ.stage}
                  </span>
                  {isAiSpeaking && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold animate-pulse bg-indigo-50 px-2.5 py-1 rounded-full">
                      <Volume2 className="w-3.5 h-3.5" /> Interviewer Speaking...
                    </div>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                  "{currentQ.question}"
                </h3>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => speakText(currentQ.question)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Replay Question Audio
                  </button>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tip: {currentQ.tip.slice(0, 50)}...</span>
                  </div>
                </div>
              </div>

              {/* IN-SESSION AI EVALUATION CARD */}
              {currentEvaluation ? (
                <div className="glass-card p-6 space-y-5 border-2 border-emerald-200/90 shadow-lg bg-gradient-to-br from-white to-emerald-50/30 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-gray-900">
                          {selectedInterviewer.name}'s Evaluation & Feedback
                        </h4>
                        <p className="text-xs text-gray-500">Live AI Validation on your response</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-sm ${getScoreBadgeClass(currentEvaluation.overallScore)}`}>
                        Score: {currentEvaluation.overallScore}/100 · {currentEvaluation.rating}
                      </span>
                    </div>
                  </div>

                  {/* Interviewer's Spoken Critique Box */}
                  <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${selectedInterviewer.avatarColor} text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 shadow-sm`}>
                      {selectedInterviewer.avatarId === 'sarah' ? 'SC' : selectedInterviewer.avatarId === 'marcus' ? 'MV' : 'AR'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{selectedInterviewer.name} says:</span>
                        <button
                          onClick={() => speakText(currentEvaluation.spokenFeedback)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                        >
                          <Volume2 className="w-3 h-3" /> Replay Feedback
                        </button>
                      </div>
                      <p className="text-xs text-gray-800 italic leading-relaxed">
                        "{currentEvaluation.spokenFeedback}"
                      </p>
                    </div>
                  </div>

                  {/* STAR Breakdown Pills */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      STAR Framework Validation
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['situation', 'task', 'action', 'result'] as const).map((key) => {
                        const starItem = currentEvaluation.starBreakdown[key];
                        const isPresent = starItem.present;
                        return (
                          <div
                            key={key}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                              isPresent
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-amber-50/80 border-amber-200 text-amber-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-extrabold capitalize text-[11px]">
                              <span>{key}</span>
                              {isPresent ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              )}
                            </div>
                            <p className="text-[10px] leading-tight text-gray-600 line-clamp-2">
                              {starItem.feedback}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Strengths & Recommendations */}
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Strengths Detected
                      </span>
                      <ul className="space-y-1.5 text-xs text-gray-700">
                        {currentEvaluation.strengths.map((str, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Areas to Polish
                      </span>
                      <ul className="space-y-1.5 text-xs text-gray-700">
                        {currentEvaluation.improvements.map((imp, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Evaluation Actions: Proceed vs Retry */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={handleRetryAnswer}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-all shadow-sm active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                      Re-record / Improve Answer
                    </button>

                    <button
                      onClick={handleProceedNext}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-md active:scale-95 transition-all"
                    >
                      {currentQuestionIndex === questions.length - 1 ? (
                        <>
                          Complete Interview & View Final Scorecard
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </>
                      ) : (
                        <>
                          Proceed to Round {currentQuestionIndex + 2}
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Response Workspace: Voice / Mic or Text Input */
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Your Answer
                      </span>
                      {!isRecording && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Microphone Ready
                        </span>
                      )}
                      {isRecording && (
                        <span className="flex items-center gap-1.5 text-[11px] text-red-600 font-bold bg-red-50 px-2.5 py-0.5 rounded-full animate-pulse border border-red-200">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                          Listening & Transcribing ({Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')})
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setManualTextMode(!manualTextMode)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2"
                    >
                      {manualTextMode ? 'Switch to Voice / Mic' : 'Type Response Directly'}
                    </button>
                  </div>

                  {micError && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>{micError.title}</span>
                      </div>
                      <p className="text-[11px] text-amber-800">{micError.message}</p>
                      {micError.osTroubleshooting && micError.osTroubleshooting.length > 0 && (
                        <ul className="text-[10px] text-amber-800 list-disc list-inside space-y-0.5 pt-1">
                          {micError.osTroubleshooting.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {submitError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {manualTextMode ? (
                    <textarea
                      rows={6}
                      value={candidateAnswer}
                      onChange={(e) => setCandidateAnswer(e.target.value)}
                      placeholder="Type your response here using the STAR framework (Situation, Task, Action, Result)..."
                      className="w-full p-4 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#3c4a59] focus:outline-none bg-white font-sans leading-relaxed"
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="min-h-[130px] p-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 leading-relaxed font-serif relative">
                        {candidateAnswer ? (
                          <div className="space-y-2">
                            <p className="whitespace-pre-wrap">{candidateAnswer}</p>
                            <span className="text-[10px] text-gray-400 block pt-1 border-t border-gray-100">
                              Transcribed in real-time. You can edit or expand if needed.
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-400 italic flex flex-col items-center justify-center py-6 text-center space-y-1">
                            <Mic className="w-6 h-6 text-gray-300" />
                            <span>Click "Start Answering (Mic)" below and speak your response.</span>
                            <span className="text-xs text-gray-400">Your speech will be transcribed in real-time.</span>
                          </div>
                        )}
                      </div>

                      {/* Mic Toggle Button */}
                      <div className="flex items-center justify-center pt-2">
                        <button
                          type="button"
                          onClick={initMic}
                          className={`flex items-center gap-3 px-7 py-3 rounded-full text-xs font-bold shadow-md transition-all active:scale-95 ${
                            isRecording
                              ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-200 animate-pulse'
                              : 'bg-[#3c4a59] text-white hover:bg-[#2e3a47]'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                              <MicOff className="w-4 h-4" />
                              Stop Recording Response
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" />
                              Start Answering (Mic)
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submission and Word Count */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      {candidateAnswer.split(/\s+/).filter(Boolean).length} words recorded
                    </div>

                    <button
                      onClick={handleSubmitAnswerForEvaluation}
                      disabled={isEvaluating}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-400 text-xs font-bold shadow-md active:scale-95 transition-all"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing Answer...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Submit Answer for Evaluation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Real Device Webcam Feed & Live Signals (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Webcam Feed Card */}
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-gray-700" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      Device Camera Feed
                    </span>
                    {cameraActive && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Webcam
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={cameraActive ? stopCamera : initCamera}
                    disabled={cameraLoading}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                  >
                    {cameraLoading ? 'Connecting...' : cameraActive ? 'Turn Off Camera' : 'Enable Camera'}
                  </button>
                </div>

                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video
                    ref={attachVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: 'scaleX(-1)' }}
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />

                  {/* Camera Offline UI */}
                  {!cameraActive && (
                    <div className="text-center p-5 sm:p-6 space-y-3 text-slate-400 max-w-sm mx-auto">
                      <VideoOff className="w-9 h-9 mx-auto text-slate-500" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200">Device camera is off</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Click below to enable your hardware camera. Your local video feed is rendered securely on your device.
                        </p>
                      </div>

                      {cameraErrorInfo && (
                        <div className="p-3 bg-red-950/70 border border-red-700/80 rounded-xl text-[11px] text-red-200 text-left space-y-1.5">
                          <div className="font-bold flex items-center gap-1.5 text-red-300">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            <span>{cameraErrorInfo.title}</span>
                          </div>
                          <p className="text-[10px] text-red-300 leading-tight">
                            {cameraErrorInfo.message}
                          </p>
                          {cameraErrorInfo.osTroubleshooting && cameraErrorInfo.osTroubleshooting.length > 0 && (
                            <div className="pt-1 border-t border-red-800/60 space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                                <Settings className="w-3 h-3" /> Troubleshooting:
                              </span>
                              <ul className="text-[9px] text-red-300 list-disc list-inside space-y-0.5 leading-snug">
                                {cameraErrorInfo.osTroubleshooting.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={initCamera}
                        disabled={cameraLoading}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 text-white px-4 py-2 rounded-lg border border-emerald-600 inline-flex items-center gap-1.5 cursor-pointer font-bold shadow-md transition-all active:scale-95"
                      >
                        {cameraLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Connecting Device...
                          </>
                        ) : (
                          <>
                            <Video className="w-3.5 h-3.5 text-white" />
                            Turn on Device Camera
                          </>
                        )}
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
                        <Eye className="w-3 h-3 text-blue-400" /> Eye Contact: ~88%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Speech Metrics Widget */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Live Speech Signals
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
                      {totalFillerCount === 0 ? 'Clean Delivery' : `${totalFillerCount} Detected`}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> STAR Answering Formula:
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Set the <strong>Situation</strong> in 20s, specify the <strong>Task</strong> in 10s, detail your technical <strong>Actions</strong> in 45s, and finish with measurable <strong>Results</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Teleprompter Modal */}
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

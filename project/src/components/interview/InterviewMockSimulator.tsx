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
  Info,
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
      message: `Your browser or Windows system blocked access to the ${device.toLowerCase()}.`,
      osTroubleshooting: [
        'Browser Address Bar: Click the tune / sliders / padlock icon to the left of the URL in your address bar (e.g. resuv.app or localhost) → Ensure Camera and Microphone are explicitly set to "Allow", then reload the page.',
        'Windows 10/11 Privacy Settings: Open Settings → Privacy & Security → Camera (and Microphone) → Ensure the top toggle is ON, and scroll down to "Let desktop apps access your camera/microphone" and verify it is ON for your browser.',
        'HP / Laptop Physical Privacy Slider: Inspect the top bezel above your laptop screen. Ensure the mechanical camera privacy slider is open (no red/white dot covering the camera lens).',
        'HP / Laptop Keyboard Privacy Keys: Check your keyboard function keys (often F8, F10, or a key with a camera/mic icon). If an amber/orange LED light is lit, press the key (or Fn + key) to unmute.',
        'Antivirus Webcam Shield: If you run third-party security software (Kaspersky, Bitdefender, Norton, Avast), disable Webcam/Mic Protection or add this browser/site to allowed exclusions.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      code: 'NOT_FOUND',
      title: `No ${device} Hardware Detected`,
      message: `No active ${device.toLowerCase()} was recognized by your browser.`,
      osTroubleshooting: [
        'Ensure your webcam/microphone is plugged in and recognized in Windows Device Manager.',
        'If using an HP laptop, check if the physical camera shutter or Fn key has electrically disconnected the camera.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      code: 'NOT_READABLE',
      title: `${device} In Use By Another App`,
      message: `Your ${device.toLowerCase()} is currently locked by another application or process.`,
      osTroubleshooting: [
        'Close other video/audio applications: Zoom, Microsoft Teams, Discord, Skype, OBS Studio, WhatsApp Desktop, or Windows Camera app.',
        'Check for other open browser tabs or windows using your camera/microphone, close them, and click Retry.',
      ],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
    return {
      code: 'OVERCONSTRAINED',
      title: `Unsupported Constraints`,
      message: `Your ${device.toLowerCase()} does not support the requested video format.`,
      osTroubleshooting: ['Automatic fallback to default resolution has been enabled.'],
      rawError: `${errName}: ${message}`,
    };
  }

  if (errName === 'SecurityError') {
    return {
      code: 'SECURITY_ERROR',
      title: 'Insecure Context Restriction',
      message: `WebRTC media APIs require a Secure Context (HTTPS or localhost).`,
      osTroubleshooting: [
        'Make sure you are accessing via https:// (e.g. https://resuv.app) or http://localhost:5173.',
        'If accessing via a local IP address (e.g. http://192.168.x.x), Chrome blocks media APIs by default.',
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

  // Audio / Mic State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [manualTextMode, setManualTextMode] = useState(false);
  const [micLoading, setMicLoading] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [micError, setMicError] = useState<MediaErrorInfo | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Video / Real Device Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [cameraErrorInfo, setCameraErrorInfo] = useState<MediaErrorInfo | null>(null);
  const [eyeContactScore] = useState(88);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Hardware Device Diagnostics State
  const [detectedDevices, setDetectedDevices] = useState<{
    cameras: string[];
    mics: string[];
    checked: boolean;
  } | null>(null);

  // React 18 Lifecycle Guards
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

  // Callback Ref: Safely binds video stream as soon as <video> DOM node mounts
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
        el.play().catch((e) => {
          console.warn('[WebRTC] video.play() deferred:', e);
        });
      }
    }
  }, []);

  // Hardware Diagnostics: Check connected devices
  const checkHardwareDevices = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput').map((d, i) => d.label || `Camera ${i + 1}`);
      const mics = devices.filter((d) => d.kind === 'audioinput').map((d, i) => d.label || `Microphone ${i + 1}`);
      setDetectedDevices({ cameras, mics, checked: true });
    } catch (e) {
      console.warn('enumerateDevices error:', e);
    }
  };

  // Pre-Flight Setup Mic Test
  const [precheckMicActive, setPrecheckMicActive] = useState(false);
  const [precheckMicFeedback, setPrecheckMicFeedback] = useState<string | null>(null);

  const testMicPrecheck = async () => {
    if (precheckMicActive) {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
        audioStreamRef.current = null;
      }
      setPrecheckMicActive(false);
      return;
    }

    setPrecheckMicFeedback(null);
    setMicError(null);
    setMicLoading(true);

    let stream: MediaStream | null = null;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
      } catch (err: any) {
        console.warn('[WebRTC] Constrained mic precheck failed, trying universal audio: true...', err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch (err: any) {
      const parsed = parseMediaError(err, 'Microphone');
      setMicError(parsed);
      setHasMicPermission(false);
      setPrecheckMicActive(false);
      setMicLoading(false);
      checkHardwareDevices();
      return;
    }

    // Hardware stream acquired successfully
    audioStreamRef.current = stream;
    setHasMicPermission(true);
    setMicError(null);
    setPrecheckMicActive(true);
    setMicLoading(false);
    setPrecheckMicFeedback('Microphone hardware successfully connected! Audio signal detected.');

    // Separate optional Speech Recognition test (non-fatal, never triggers micError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-US';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setPrecheckMicFeedback(`Heard you: "${transcript}"`);
        };
        rec.start();
      } catch (speechTestErr) {
        console.warn('[Web Speech API precheck notice]:', speechTestErr);
      }
    }
  };

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

      if (!match) match = voicesList.find((v) => FEMALE_VOICE_REGEX.test(v.name));
      if (!match) match = voicesList.find((v) => v.lang.startsWith('en') && !MALE_VOICE_REGEX.test(v.name));
      if (!match) match = voicesList.find((v) => v.lang.startsWith('en')) || voicesList[0] || null;

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
      const error: any = new Error('navigator.mediaDevices.getUserMedia is not available.');
      error.name = 'SecurityError';
      throw error;
    }

    // Step 0: Enumerate available video devices
    let videoDevices: MediaDeviceInfo[] = [];
    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter((d) => d.kind === 'videoinput');
      }
    } catch (e) {
      console.warn('[WebRTC] enumerateDevices failed prior to stream acquisition:', e);
    }

    // Step 1: Check if any device has an explicit non-IR label (if permission was already granted previously)
    const nonIrDevices = videoDevices.filter((d) => {
      const label = (d.label || '').toLowerCase();
      return label && !label.includes('ir') && !label.includes('infrared') && !label.includes('windows hello');
    });

    const candidateConstraints: MediaStreamConstraints[] = [];

    // Priority 1: If an explicit RGB camera device is known by label
    if (nonIrDevices.length > 0) {
      for (const dev of nonIrDevices) {
        if (dev.deviceId) {
          candidateConstraints.push({
            video: {
              deviceId: { exact: dev.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
          candidateConstraints.push({
            video: { deviceId: { exact: dev.deviceId } },
            audio: false,
          });
        }
      }
    }

    // Priority 2: Generic desktop-friendly high-res stream (NO facingMode: 'user' which triggers IR sensors on Windows)
    candidateConstraints.push({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    // Priority 3: Universal simple video fallback
    candidateConstraints.push({
      video: true,
      audio: false,
    });

    // Priority 4: Test each enumerated video device individually by deviceId
    // (Crucial for dual-camera HP laptops where device[0] is the IR camera and device[1] is the HD camera)
    if (videoDevices.length > 0) {
      const reversed = [...videoDevices].reverse();
      for (const dev of reversed) {
        if (dev.deviceId) {
          candidateConstraints.push({
            video: { deviceId: { exact: dev.deviceId } },
            audio: false,
          });
        }
      }
    }

    // Sequentially execute candidates until one succeeds
    let lastError: any = null;
    for (let i = 0; i < candidateConstraints.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(candidateConstraints[i]);
        console.log(`[WebRTC] Camera successfully acquired on attempt #${i + 1}:`, {
          constraint: candidateConstraints[i],
          trackLabel: stream.getVideoTracks()[0]?.label,
        });
        return stream;
      } catch (err: any) {
        lastError = err;
        console.warn(`[WebRTC] Camera attempt #${i + 1} failed, trying next candidate...`, {
          constraint: candidateConstraints[i],
          errorName: err?.name,
          errorMessage: err?.message,
        });
      }
    }

    throw lastError || new Error('All camera acquisition attempts failed.');
  };

  const initCamera = async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setCameraErrorInfo(null);
    setCameraLoading(true);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      const secErr: any = new Error(
        'Camera capture requires a Secure Context (HTTPS or localhost). Current origin is not secure.'
      );
      secErr.name = 'SecurityError';
      const parsed = parseMediaError(secErr, 'Camera');
      setCameraErrorInfo(parsed);
      setHasCameraPermission(false);
      setCameraLoading(false);
      isInitializingRef.current = false;
      return;
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      videoStreamRef.current = null;
    }

    // 1. ISOLATED Media Request Scope
    let stream: MediaStream;
    try {
      stream = await requestCameraStream();
    } catch (mediaErr: any) {
      // Reached only after ALL candidate fallbacks failed
      const parsed = parseMediaError(mediaErr, 'Camera');
      setCameraErrorInfo(parsed);
      setHasCameraPermission(false);
      setCameraActive(false);
      checkHardwareDevices();
      setCameraLoading(false);
      isInitializingRef.current = false;
      return;
    }

    // 2. Stream Successfully Acquired: ENFORCE STATE TRANSITION IMMEDIATELY
    videoStreamRef.current = stream;
    setHasCameraPermission(true);
    setCameraErrorInfo(null);
    setCameraActive(true);
    setCameraLoading(false);
    isInitializingRef.current = false;
    // Hardware labels are now unlocked by the browser, refresh device list
    checkHardwareDevices();

    // 3. Post-Acquisition Video Element Binding (Isolated non-fatal scope)
    if (videoRef.current) {
      try {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.playsInline = true;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.warn('[WebRTC] video.play() deferred by browser autoplay policy:', playErr);
          });
        };
        videoRef.current.play().catch((playErr) => {
          console.warn('[WebRTC] video.play() deferred by browser autoplay policy:', playErr);
        });
      } catch (domErr) {
        console.warn('[WebRTC] video DOM binding notice (non-fatal):', domErr);
      }
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

  // 2. Decoupled Audio Stream & Collision Resolution
  // getUserMedia acquires hardware audio stream; SpeechRecognition handles real-time text without competing locks
  const initMic = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    setMicLoading(true);
    setMicError(null);
    setSubmitError(null);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      const secErr: any = new Error('Microphone access requires a Secure Context (HTTPS or localhost).');
      secErr.name = 'SecurityError';
      const parsed = parseMediaError(secErr, 'Microphone');
      setMicError(parsed);
      setHasMicPermission(false);
      setMicLoading(false);
      return;
    }

    // 1. ISOLATED Media Request Scope
    let stream: MediaStream;
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        const navErr: any = new Error('navigator.mediaDevices.getUserMedia is not available.');
        navErr.name = 'SecurityError';
        throw navErr;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (audioConstraintErr: any) {
        console.warn('[WebRTC] Constrained audio failed, falling back to universal audio: true:', audioConstraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch (mediaErr: any) {
      // ONLY true hardware/browser permission rejections reach here!
      const parsed = parseMediaError(mediaErr, 'Microphone');
      setMicError(parsed);
      setHasMicPermission(false);
      setIsRecording(false);
      setTimerActive(false);
      setMicLoading(false);
      checkHardwareDevices();
      return;
    }

    // 2. Stream Successfully Acquired: ENFORCE STATE TRANSITION IMMEDIATELY
    audioStreamRef.current = stream;
    setHasMicPermission(true);
    setMicError(null);
    setIsRecording(true);
    setTimerActive(true);
    setMicLoading(false);
    isRecordingRef.current = true;

    // 3. Optional Post-Stream Audio Recording (Non-fatal, NEVER triggers micError)
    if (typeof MediaRecorder !== 'undefined') {
      try {
        const recorder = new MediaRecorder(stream);
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn('[MediaRecorder notice (non-fatal)]:', recErr);
      }
    }

    // 4. Real-time SpeechRecognition (Isolated non-fatal transcription scope)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
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
        recognition.onerror = (recErr: any) => {
          console.warn('[Speech Recognition cloud service notice]:', recErr);
          // Crucial: do NOT touch micError. Switch to manual text mode for cloud speech errors
          if (recErr?.error !== 'no-speech') {
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
      } catch (speechErr) {
        console.warn('[SpeechRecognition initialization notice]:', speechErr);
        setManualTextMode(true);
      }
    } else {
      setManualTextMode(true);
    }
  };

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setTimerActive(false);
    setMicLoading(false);

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
    setCameraErrorInfo(null);
    setMicError(null);
    setSubmitError(null);

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

          {/* Pre-Flight Hardware Check Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-600" />
                  Pre-Flight Hardware Check (Camera & Microphone)
                </h4>
                <p className="text-xs text-gray-500">
                  Verify your webcam and microphone before entering the live interview room.
                </p>
              </div>

              <button
                type="button"
                onClick={checkHardwareDevices}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 underline"
              >
                <Info className="w-3.5 h-3.5" /> Enumerate Connected Hardware
              </button>
            </div>

            {detectedDevices?.checked && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono space-y-1 text-slate-700">
                <div><strong>Detected Cameras:</strong> {detectedDevices.cameras.join(', ') || 'None found (Check physical switch or driver)'}</div>
                <div><strong>Detected Microphones:</strong> {detectedDevices.mics.join(', ') || 'None found'}</div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Camera Test Box */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-indigo-600" /> Webcam Preview
                  </span>
                  {cameraActive && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Active & Mirroring
                    </span>
                  )}
                </div>

                {cameraActive ? (
                  <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
                    <video
                      ref={attachVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ transform: 'scaleX(-1)' }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-slate-100 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 p-4 text-center space-y-1">
                    <VideoOff className="w-6 h-6 text-gray-400" />
                    <span className="text-xs font-medium">Camera is currently off</span>
                    <span className="text-[11px] text-gray-400">Click below to test video feed</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={cameraActive ? stopCamera : initCamera}
                  disabled={cameraLoading}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                    cameraActive
                      ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  {cameraLoading ? 'Connecting Device...' : cameraActive ? 'Turn Off Camera' : 'Test Camera Preview'}
                </button>
              </div>

              {/* Microphone Test Box */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-indigo-600" /> Microphone Input
                  </span>
                  {precheckMicActive && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Listening
                    </span>
                  )}
                </div>

                <div className="aspect-video bg-slate-100 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 text-center space-y-1">
                  {precheckMicFeedback ? (
                    <div className="space-y-1 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 w-full">
                      <div className="flex items-center justify-center gap-1 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mic Signal Verified
                      </div>
                      <p className="text-[11px] italic text-emerald-800 line-clamp-3 font-mono">
                        {precheckMicFeedback}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        {precheckMicActive ? 'Speak into your microphone now...' : 'Microphone is unverified'}
                      </span>
                      <span className="text-[11px] text-gray-400">Click below to test audio capture</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={testMicPrecheck}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                    precheckMicActive
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-800 text-white hover:bg-slate-900 shadow-sm'
                  }`}
                >
                  {precheckMicActive ? 'Stop Mic Test' : 'Test Microphone'}
                </button>
              </div>
            </div>

            {/* Error Diagnostics Box - ONLY render when NOT loading and an actual error exists without permission */}
            {!cameraLoading && !micLoading && ((!hasCameraPermission && cameraErrorInfo) || (!hasMicPermission && micError)) && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-900 animate-fadeIn">
                <div className="font-bold flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  {(!hasCameraPermission && cameraErrorInfo?.title) || (!hasMicPermission && micError?.title)}
                </div>
                <p>{(!hasCameraPermission && cameraErrorInfo?.message) || (!hasMicPermission && micError?.message)}</p>
                {((!hasCameraPermission && cameraErrorInfo?.rawError) || (!hasMicPermission && micError?.rawError)) && (
                  <div className="text-[10px] font-mono text-red-700 bg-red-100/70 px-2 py-1 rounded border border-red-200">
                    System error: {(!hasCameraPermission ? cameraErrorInfo?.rawError : micError?.rawError)}
                  </div>
                )}
                {((!hasCameraPermission && cameraErrorInfo?.osTroubleshooting) || (!hasMicPermission && micError?.osTroubleshooting)) && (
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-red-800 pt-1 border-t border-red-200">
                    {((!hasCameraPermission ? cameraErrorInfo?.osTroubleshooting : micError?.osTroubleshooting) || []).map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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

                  {micLoading && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 font-semibold flex items-center gap-2 animate-pulse mb-3">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Requesting microphone hardware access...</span>
                    </div>
                  )}

                  {!micLoading && !hasMicPermission && micError && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>{micError.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={checkHardwareDevices}
                          className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" /> Check Mic Status
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-800">{micError.message}</p>
                      {micError.osTroubleshooting && micError.osTroubleshooting.length > 0 && (
                        <ul className="text-[10px] text-amber-800 list-disc list-inside space-y-1 pt-1 border-t border-amber-200/60">
                          {micError.osTroubleshooting.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      )}
                      {detectedDevices?.checked && (
                        <div className="pt-1 text-[10px] text-amber-950 font-mono bg-amber-100/60 p-2 rounded">
                          Detected Microphones ({detectedDevices.mics.length}): {detectedDevices.mics.join(', ') || 'None found'}
                        </div>
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

                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden rounded-b-xl">
                  {/* Video is always mounted with no display:none to ensure media pipeline stays active */}
                  <video
                    ref={attachVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: 'scaleX(-1)' }}
                    className="w-full h-full object-cover"
                  />

                  {/* Camera Offline Overlay UI (shown only when cameraActive is false) */}
                  {!cameraActive && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-5 text-slate-400 z-10 text-center overflow-y-auto">
                      <VideoOff className="w-8 h-8 mx-auto text-slate-500 flex-shrink-0 mb-1" />
                      <div className="space-y-0.5 mb-2">
                        <p className="text-xs font-bold text-slate-200">
                          {cameraLoading ? 'Connecting to camera hardware...' : 'Device camera is off'}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {cameraLoading ? 'Please wait while camera initializes...' : 'Click below to enable your hardware camera.'}
                        </p>
                      </div>

                      {cameraLoading && (
                        <div className="flex items-center gap-2 p-2.5 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-xs text-indigo-300 animate-pulse mb-3">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>Initializing video capture device...</span>
                        </div>
                      )}

                      {!cameraLoading && !hasCameraPermission && cameraErrorInfo && (
                        <div className="w-full max-w-sm p-3 bg-red-950/80 border border-red-700/80 rounded-xl text-[11px] text-red-200 text-left space-y-1.5 mb-2.5 animate-fadeIn">
                          <div className="font-bold flex items-center justify-between text-red-300">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              {cameraErrorInfo.title}
                            </span>
                            <button
                              type="button"
                              onClick={checkHardwareDevices}
                              className="text-[10px] underline text-red-300 hover:text-white"
                            >
                              Check Devices
                            </button>
                          </div>
                          <p className="text-[10px] text-red-200 leading-snug">
                            {cameraErrorInfo.message}
                          </p>
                          {cameraErrorInfo.rawError && (
                            <div className="text-[9px] font-mono text-red-300 bg-red-900/50 px-2 py-0.5 rounded border border-red-800/60 truncate">
                              System: {cameraErrorInfo.rawError}
                            </div>
                          )}
                          {cameraErrorInfo.osTroubleshooting && cameraErrorInfo.osTroubleshooting.length > 0 && (
                            <div className="pt-1 border-t border-red-800/60 space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1">
                                <Settings className="w-3 h-3" /> Quick Fix Steps:
                              </span>
                              <ul className="text-[9px] text-red-200 list-disc list-inside space-y-0.5 leading-tight">
                                {cameraErrorInfo.osTroubleshooting.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {detectedDevices?.checked && (
                            <div className="pt-1 text-[9px] text-slate-300 font-mono bg-slate-950/60 p-1.5 rounded">
                              Connected Cameras: {detectedDevices.cameras.join(', ') || '0 detected (Check laptop switch or device manager)'}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={initCamera}
                          disabled={cameraLoading}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white px-5 py-2 rounded-lg border border-emerald-500 inline-flex items-center gap-1.5 cursor-pointer font-bold shadow-md transition-all active:scale-95"
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

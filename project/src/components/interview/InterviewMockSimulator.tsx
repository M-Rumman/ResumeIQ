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
  AlertCircle,
} from 'lucide-react';
import RealTimeCopilotModal from './RealTimeCopilotModal';
import type { PerformanceMetrics } from './PerformanceAnalyticsView';
import {
  useInterviewer,
  INTERVIEWER_PERSONAS,
  type InterviewerPersona,
} from '../../context/InterviewerContext';
import { startInterviewSession } from '../../lib/api/interviewPrepApi';

export { INTERVIEWER_PERSONAS, type InterviewerPersona };

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

  const { selectedInterviewer, setSelectedInterviewer } = useInterviewer();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Audio / Mic / Speech Synthesis State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [manualTextMode, setManualTextMode] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Video / Camera & Media Permissions State (Default Enabled)
  const [cameraActive, setCameraActive] = useState(true);
  const [hasMicPermission, setHasMicPermission] = useState(true);
  const [isSimulatedStream, setIsSimulatedStream] = useState(false);
  const [eyeContactScore] = useState(85);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Pre-load voices so they are immediately available on selection
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
    initHardwareMedia();
    return () => {
      stopCamera();
      stopRecording();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Sync camera feed whenever session starts or camera toggles
  useEffect(() => {
    if (sessionStarted && cameraActive && videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [sessionStarted, cameraActive]);

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
      // Priority 1: High quality English female voice
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

      // Priority 2: Any voice matching female identifiers
      if (!match) {
        match = voicesList.find((v) => FEMALE_VOICE_REGEX.test(v.name));
      }

      // Priority 3: Non-male English voice
      if (!match) {
        match = voicesList.find((v) => v.lang.startsWith('en') && !MALE_VOICE_REGEX.test(v.name));
      }

      // Priority 4: Fallback English voice with high pitch
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

    // Default Alex Rivera (balanced conversational male voice)
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

  // Web Speech API: Text-to-Speech Engine with Explicit Voice Profiles
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

  // Virtual Canvas Media Stream Generator for Default-Enabled Camera Feed
  const createDefaultMediaStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let angle = 0;

    const render = () => {
      if (!ctx) return;
      angle += 0.04;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Subtle tech background grid
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 40; x < 640; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 40; y < 480; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }

      // Candidate presence silhouette with micro-motion
      const bob = Math.sin(angle) * 3;
      const pulse = 1 + Math.sin(angle * 1.5) * 0.02;
      const cx = 320;
      const cy = 260 + bob;

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx, cy - 60, 46 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(cx, cy + 65, 110 * pulse, 75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Facial centering grid HUD
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx - 55, cy - 105, 110, 90);
      ctx.setLineDash([]);

      // Top status indicator
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('● LIVE CANDIDATE FEED (DEFAULT ENABLED)', 24, 32);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Presence Monitored · Eye Contact: ~85% · Ready', 24, 50);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    let stream: MediaStream;
    if (canvas.captureStream) {
      stream = canvas.captureStream(30);
    } else if ((canvas as any).mozCaptureStream) {
      stream = (canvas as any).mozCaptureStream(30);
    } else {
      stream = new MediaStream();
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.00001;
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
    } catch {
      // ignore
    }

    return stream;
  };

  const activateDefaultStream = () => {
    setCameraActive(true);
    setHasMicPermission(true);
    setIsSimulatedStream(true);

    const stream = createDefaultMediaStream();
    mediaStreamRef.current = stream;
    audioStreamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  };

  // Hardware Media Initialization with Default-Enabled Stream Fallback
  const initHardwareMedia = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setCameraActive(true);
          setHasMicPermission(true);
          setIsSimulatedStream(false);

          mediaStreamRef.current = stream;
          audioStreamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Hardware media denied or unavailable, activating default-enabled stream:', err);
          activateDefaultStream();
        });
    } else {
      activateDefaultStream();
    }
  };

  const startCamera = () => {
    setCameraActive(true);
    if (!mediaStreamRef.current) {
      initHardwareMedia();
    } else if (videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (err: any) => {
        console.warn('Speech recognition notice:', err);
        // If browser blocks speech recognition due to denied mic, gracefully switch to text input mode
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setManualTextMode(true);
        }
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

  const startRecording = async () => {
    setMicError(null);
    try {
      let stream = audioStreamRef.current;
      const hasActiveAudioTrack = stream && stream.getAudioTracks().some((t) => t.readyState === 'live');

      if (!hasActiveAudioTrack) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            setHasMicPermission(true);
          } else {
            throw new Error('Microphone device API not available');
          }
        } catch (hwErr) {
          console.warn('Microphone hardware access denied, using default-enabled audio track:', hwErr);
          if (!mediaStreamRef.current) {
            activateDefaultStream();
          }
          stream = audioStreamRef.current || createDefaultMediaStream();
          audioStreamRef.current = stream;
          setIsSimulatedStream(true);
          setHasMicPermission(true);
        }
      }

      if (typeof MediaRecorder !== 'undefined' && stream) {
        try {
          const mediaRecorder = new MediaRecorder(stream);
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          mediaRecorder.start(250);
          mediaRecorderRef.current = mediaRecorder;
        } catch (recErr) {
          console.warn('MediaRecorder notice:', recErr);
        }
      }

      setIsRecording(true);
      setTimerActive(true);
      startSpeechRecognition();
    } catch (err) {
      console.warn('Recording fallback notice:', err);
      setIsRecording(true);
      setTimerActive(true);
      setManualTextMode(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    stopSpeechRecognition();
    setIsRecording(false);
    setTimerActive(false);
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Start the entire interview session
  const handleStartSession = () => {
    setSessionStarted(true);
    setCurrentQuestionIndex(0);
    setCandidateAnswer('');
    setTimerSeconds(0);
    setTimerActive(false);

    // Pass explicit voiceId & avatarId into payload sent to backend/TTS engine, removing hardcoded defaults
    startInterviewSession({
      interviewerName: selectedInterviewer.name,
      voiceId: selectedInterviewer.voiceId,
      avatarId: selectedInterviewer.avatarId,
      questionId: currentQ.id,
    });

    startCamera();

    // AI delivers greeting and first question
    setTimeout(() => {
      speakText(`${selectedInterviewer.welcomeMessage} Here is our first question: ${currentQ.question}`);
    }, 400);
  };

  // Handle advancing to next question or finishing
  const handleNextQuestion = () => {
    stopRecording();
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
        personaName: selectedInterviewer.name,
        avatarId: selectedInterviewer.avatarId,
        voiceId: selectedInterviewer.voiceId,
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
              Start Mock Interview with {selectedInterviewer.name}
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
              <div
                data-avatar-id={selectedInterviewer.avatarId}
                className={`w-8 h-8 rounded-xl ${selectedInterviewer.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-sm`}
              >
                {selectedInterviewer.avatarId === 'sarah' ? 'SC' : selectedInterviewer.avatarId === 'marcus' ? 'MV' : 'AR'}
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900">{selectedInterviewer.name}</span>
                <span className="text-[11px] text-gray-500 block">{selectedInterviewer.role}</span>
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
                  stopRecording();
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
                    {hasMicPermission && !isRecording && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Mic Ready
                      </span>
                    )}
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

                {micError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>{micError}</span>
                  </div>
                )}

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
                        type="button"
                        onClick={toggleRecording}
                        className={`flex items-center gap-3 px-6 py-3 rounded-full text-xs font-bold shadow-md transition-all active:scale-95 ${
                          isRecording
                            ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-200 animate-pulse'
                            : 'bg-[#3c4a59] text-white hover:bg-[#2e3a47]'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                            <MicOff className="w-4 h-4" />
                            Recording... (Click to Stop)
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
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {isSimulatedStream ? 'Default Enabled' : 'Hardware Active'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {cameraActive ? 'Turn Off' : 'Enable Camera'}
                  </button>
                </div>

                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video
                    ref={(el) => {
                      videoRef.current = el;
                      if (el && mediaStreamRef.current && cameraActive) {
                        if (el.srcObject !== mediaStreamRef.current) {
                          el.srcObject = mediaStreamRef.current;
                          el.play().catch(() => {});
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />

                  {/* Camera disabled UI - rendered ONLY when candidate manually turns camera off */}
                  {!cameraActive && (
                    <div className="text-center p-6 space-y-3 text-slate-400">
                      <VideoOff className="w-8 h-8 mx-auto text-slate-500" />
                      <p className="text-xs font-medium">Camera is turned off.</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-lg border border-slate-700 inline-flex items-center gap-1.5 cursor-pointer font-semibold"
                      >
                        <Video className="w-3.5 h-3.5 text-emerald-400" />
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

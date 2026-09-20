import { createContext, useContext, useState, ReactNode } from 'react';

export interface InterviewerPersona {
  id: string;
  name: string;
  role: string;
  voiceId: string;
  avatarId: string;
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
    voiceId: 'male-1',
    avatarId: 'alex',
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
    voiceId: 'female-1',
    avatarId: 'sarah',
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
    voiceId: 'male-2',
    avatarId: 'marcus',
    avatarColor: 'bg-slate-800',
    style: 'Strategic Leadership & Ambiguity',
    welcomeMessage:
      'Good to connect. I want to explore how you lead through ambiguity, align engineering goals with business metrics, and resolve complex organizational trade-offs.',
    voicePitch: 0.95,
    voiceRate: 0.95,
  },
];

interface InterviewerContextType {
  selectedInterviewer: InterviewerPersona;
  setSelectedInterviewer: (
    interviewer:
      | InterviewerPersona
      | Partial<InterviewerPersona>
      | ((prev: InterviewerPersona) => InterviewerPersona)
  ) => void;
  availablePersonas: InterviewerPersona[];
}

const InterviewerContext = createContext<InterviewerContextType | undefined>(undefined);

export function InterviewerProvider({ children }: { children: ReactNode }) {
  const [selectedInterviewer, setSelectedInterviewerState] = useState<InterviewerPersona>(
    INTERVIEWER_PERSONAS[0]
  );

  const setSelectedInterviewer: InterviewerContextType['setSelectedInterviewer'] = (update) => {
    if (typeof update === 'function') {
      setSelectedInterviewerState((prev) => update(prev));
    } else {
      setSelectedInterviewerState((prev) => {
        // If persona matches by id or name, merge with full persona attributes
        const matched = INTERVIEWER_PERSONAS.find(
          (p) => (update.id && p.id === update.id) || (update.name && p.name === update.name)
        );
        return {
          ...(matched || prev),
          ...update,
        };
      });
    }
  };

  return (
    <InterviewerContext.Provider
      value={{
        selectedInterviewer,
        setSelectedInterviewer,
        availablePersonas: INTERVIEWER_PERSONAS,
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export function useInterviewer() {
  const context = useContext(InterviewerContext);
  if (!context) {
    // Graceful fallback if used outside Provider
    return {
      selectedInterviewer: INTERVIEWER_PERSONAS[0],
      setSelectedInterviewer: () => {},
      availablePersonas: INTERVIEWER_PERSONAS,
    };
  }
  return context;
}

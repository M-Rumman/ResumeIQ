import React, { useState, useEffect } from 'react';

const insights = [
  "Your resume is the first thing recruiters see.",
  "Tailor your resume for every job application.",
  "ATS systems scan resumes before recruiters do.",
  "Recruiters often spend only seconds on an initial resume review.",
  "A well-written summary can immediately capture attention.",
  "Missing keywords can prevent your resume from reaching a recruiter.",
  "Projects can be just as valuable as work experience for students.",
  "Strong action verbs make achievements more impactful."
];

export interface LoadingScreenProps {
  isLoading: boolean;
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, message }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % insights.length);
      }, 3500); // Cycles every 3.5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity"
    >
      {/* Branded spinner matching the orange theme */}
      <div
        className="w-12 h-12 border-4 rounded-full animate-spin mb-8"
        style={{
          borderColor: 'var(--accent-orange-light, #FFF0E6)',
          borderTopColor: 'var(--accent-orange, #FF6B00)',
        }}
      />

      <div className="text-center max-w-md px-6">
        <h3
          className="text-sm font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--accent-orange, #FF6B00)' }}
        >
          {message || 'Did you know?'}
        </h3>
        <p
          className="text-lg font-medium animate-pulse"
          style={{ color: 'var(--text-main, #1A1C20)' }}
        >
          {insights[currentIndex]}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;

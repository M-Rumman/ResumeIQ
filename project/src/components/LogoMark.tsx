import React from 'react';

export interface LogoMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * ResuV Primary Brand Mark
 * Uses the modern checkmark geometric shape matching /favicon.svg
 * Styled with the primary theme accent: var(--accent-orange, #FF6B00)
 */
export default function LogoMark({ className = 'w-8 h-8', ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 2000 2000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 inline-block align-middle ${className}`}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M602.17 1440.26L249.41 1134.88L503.32 841.57L856.08 1146.95ZM1125.64 1431.77L859.34 1149.65L1484.29 559.74L1750.59 841.86Z"
        fill="var(--accent-orange, #FF6B00)"
      />
    </svg>
  );
}

import { FileText, Check } from 'lucide-react';

interface LogoMarkProps {
  className?: string;
}

/** ResuV mark: brand box, document page, check on top */
export default function LogoMark({ className = 'w-8 h-8 rounded-lg' }: LogoMarkProps) {
  return (
    <div
      className={`bg-[#3c4a59] flex items-center justify-center relative shrink-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <FileText className="absolute w-[52%] h-[52%] text-white" strokeWidth={2} />
      <Check
        className="absolute w-[36%] h-[36%] text-white translate-x-[24%] translate-y-[24%]"
        strokeWidth={3}
      />
    </div>
  );
}

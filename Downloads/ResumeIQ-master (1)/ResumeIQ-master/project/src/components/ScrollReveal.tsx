import type { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

export default function ScrollReveal({ children, className = '', as: Tag = 'div' }: ScrollRevealProps) {
  return <Tag className={`scroll-reveal ${className}`.trim()}>{children}</Tag>;
}

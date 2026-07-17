import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StaticPageLayoutProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}

export default function StaticPageLayout({ title, subtitle, icon: Icon, children }: StaticPageLayoutProps) {
  return (
    <div className="min-h-screen">
      <div className="glass-nav border-b-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">{title}</h1>
          </div>
          {subtitle && <p className="text-gray-900 text-base font-medium ml-[52px]">{subtitle}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card-solid static-page-content p-6 sm:p-8 scroll-reveal is-visible">{children}</div>
      </div>
    </div>
  );
}

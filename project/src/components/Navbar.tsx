import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Menu, X } from 'lucide-react';
import LogoMark from './LogoMark';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  session: Session | null;
  onLogout: () => void;
}

export default function Navbar({ currentPage, onNavigate, session, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function goTo(page: string) {
    onNavigate(page);
    setMobileOpen(false);
  }

  const links = [
    { label: 'Home', page: 'home' },
    { label: 'Resume Analyzer', page: 'analyzer' },
    { label: 'Interview Prep', page: 'interview' },
    { label: 'Dashboard', page: 'dashboard' },
    { label: 'Pricing', page: 'pricing' },
  ];

  const navLinkClass = (page: string) =>
    `nav-link whitespace-nowrap ${currentPage === page ? 'nav-link-active' : ''}`;

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex shrink-0 items-center gap-2 font-display text-xl text-primary font-extrabold hover:opacity-80 transition-opacity whitespace-nowrap tracking-[0.03em]"
          >
            <LogoMark className="w-8 h-8 rounded-lg" />
            ResuV
          </button>

          <div className="hidden lg:flex items-center justify-end flex-1 min-w-0 gap-6 xl:gap-8">
            {links.map((link) => (
              <button key={link.page} type="button" onClick={() => onNavigate(link.page)} className={navLinkClass(link.page)}>
                {link.label}
              </button>
            ))}
            {session ? (
              <button type="button" onClick={onLogout} className="nav-link whitespace-nowrap shrink-0">
                Log Out
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onNavigate('login')} className={navLinkClass('login')}>
                  Login
                </button>
                <button type="button" onClick={() => onNavigate('signup')} className="btn-ghost text-sm py-2 px-4">
                  Sign Up
                </button>
                <button type="button" onClick={() => onNavigate('signup')} className="btn-primary text-sm py-2 px-4">
                  Get Started
                </button>
              </>
            )}
          </div>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-[var(--radius-md)] text-secondary neu-pressed"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[rgba(255,255,255,0.35)] glass-panel mx-4 mb-3 rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <button
                key={link.page}
                type="button"
                onClick={() => goTo(link.page)}
                className={`w-full text-left whitespace-nowrap px-3 py-2 rounded-[var(--radius-md)] text-sm font-bold transition-colors ${
                  currentPage === link.page ? 'neu-pressed text-accent' : 'text-secondary hover:text-primary'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              {session ? (
                <button type="button" onClick={() => { onLogout(); setMobileOpen(false); }} className="btn-ghost w-full">
                  Log Out
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => goTo('login')} className="btn-ghost w-full">
                    Login
                  </button>
                  <button type="button" onClick={() => goTo('signup')} className="btn-primary w-full">
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

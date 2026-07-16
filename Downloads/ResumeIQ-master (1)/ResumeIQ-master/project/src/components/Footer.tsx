import LogoMark from './LogoMark';

interface FooterProps {
  onNavigate: (page: string) => void;
}

function FooterLink({ label, page, onNavigate }: { label: string; page: string; onNavigate: (page: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold"
    >
      {label}
    </button>
  );
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="glass-panel mt-auto border-t border-[rgba(255,255,255,0.35)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 text-primary font-display text-lg font-extrabold hover:opacity-90 transition-opacity w-fit tracking-[0.03em]"
            >
              <LogoMark className="w-7 h-7 rounded-lg" />
              ResuV
            </button>
            <p className="text-sm max-w-xs leading-relaxed text-body">
              Smart resume optimization and interview preparation platform.
            </p>
          </div>

          <div className="flex flex-wrap gap-12">
            <div className="flex flex-col gap-3">
              <span className="text-primary text-sm font-display tracking-[0.03em]">Product</span>
              <FooterLink label="Resume Analyzer" page="analyzer" onNavigate={onNavigate} />
              <FooterLink label="Interview Prep" page="interview" onNavigate={onNavigate} />
              <FooterLink label="Pricing" page="pricing" onNavigate={onNavigate} />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-primary text-sm font-display tracking-[0.03em]">Company</span>
              <FooterLink label="About" page="about" onNavigate={onNavigate} />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-primary text-sm font-display tracking-[0.03em]">Legal</span>
              <FooterLink label="Privacy Policy" page="privacy" onNavigate={onNavigate} />
              <FooterLink label="Terms of Service" page="terms" onNavigate={onNavigate} />
              <FooterLink label="Refund Policy" page="refund-policy" onNavigate={onNavigate} />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-primary text-sm font-display tracking-[0.03em]">Support</span>
              <FooterLink label="Contact" page="contact" onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[rgba(255,255,255,0.35)] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-body">© {new Date().getFullYear()} ResuV. All rights reserved.</p>
          <p className="text-sm text-body">Built for career success.</p>
        </div>
      </div>
    </footer>
  );
}

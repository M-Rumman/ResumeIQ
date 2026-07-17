import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import ReactGA from 'react-ga4';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import ResumeAnalyzerPage from './pages/ResumeAnalyzerPage';
import InterviewPrepPage from './pages/InterviewPrepPage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import CheckYourEmailPage from './pages/CheckYourEmailPage';
import ResumeAnalyzerLandingPage from './pages/ResumeAnalyzerLandingPage';
import ResumeKeywordOptimizerLandingPage from './pages/ResumeKeywordOptimizerLandingPage';
import ResumeScoreCheckerLandingPage from './pages/ResumeScoreCheckerLandingPage';
import ResumeFeedbackLandingPage from './pages/ResumeFeedbackLandingPage';
import InterviewPrepLandingPage from './pages/InterviewPrepLandingPage';
import CheckoutResume from './components/CheckoutResume';
import { supabase } from './lib/supabase.js';
import { handleSupabaseAuthCallback } from './lib/authCallback.js';
import { isEmailVerified } from './lib/emailVerification.js';
import { isPasswordResetPath } from './lib/passwordReset.js';
import { isProtectedPage } from './lib/protectedPages';
import { useScrollReveal } from './hooks/useScrollReveal';
import { pathToPage, pageToPath, type RoutablePage } from './lib/routes';
import { BillingProvider } from './context/BillingContext';
import { usePageSeo } from './hooks/usePageSeo';

type Page = RoutablePage | 'payment-success';

function resolveInitialPage(): Page {
  const params = new URLSearchParams(window.location.search);

  if (params.get('payment') === 'success') {
    return 'payment-success';
  }

  const fromPath = pathToPage(window.location.pathname);
  if (fromPath) return fromPath;

  if (params.has('reset-password') || params.get('type') === 'recovery') {
    return 'reset-password';
  }

  return 'home';
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(resolveInitialPage);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRedirect, setAuthRedirect] = useState<Page | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useScrollReveal([currentPage]);
  usePageSeo(currentPage);

  useEffect(() => {
    if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
      ReactGA.send({
        hitType: 'pageview',
        page: pageToPath(currentPage === 'payment-success' ? 'home' : currentPage),
      });
    }
  }, [currentPage]);

  useEffect(() => {
    const id = import.meta.env.VITE_CLARITY_PROJECT_ID;
    if (!id || document.getElementById('clarity-script')) return;

    const script = document.createElement('script');
    script.id = 'clarity-script';
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${id}`;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const callback = await handleSupabaseAuthCallback();
      if (!mounted) return;

      if (callback.emailVerified) {
        setSession(null);
        setAuthLoading(false);
        setCurrentPage('login');
        window.history.replaceState({}, '', '/login?verified=1');
        return;
      }

      if (callback.error && !callback.passwordRecovery) {
        setAuthNotice(callback.error);
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const isPasswordRecovery =
        callback.passwordRecovery || isPasswordResetPath() || currentPage === 'reset-password';

      if (data.session && !isEmailVerified(data.session.user) && !isPasswordRecovery) {
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(data.session);
      }
      setAuthLoading(false);

      if (isPasswordRecovery) {
        setCurrentPage('reset-password');
        if (data.session) {
          setSession(data.session);
        }
        window.history.replaceState({}, '', '/reset-password');
      } else if (callback.passwordRecovery && callback.error) {
        setAuthNotice(callback.error);
        setCurrentPage('reset-password');
        window.history.replaceState({}, '', '/reset-password');
      }

      if (window.location.search.includes('payment=success')) {
        setCurrentPage('payment-success');
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (
        callback.handled &&
        data.session &&
        !callback.error &&
        isEmailVerified(data.session.user) &&
        !isPasswordRecovery
      ) {
        setCurrentPage('home');
        window.history.replaceState({}, '', '/');
      }
    }

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (nextSession && !isEmailVerified(nextSession.user) && event !== 'PASSWORD_RECOVERY') {
        setSession(null);
      } else {
        setSession(nextSession);
      }
      setAuthLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        setSession(nextSession);
        setCurrentPage('reset-password');
        window.history.replaceState({}, '', '/reset-password');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onPopState() {
      const page = pathToPage(window.location.pathname);
      if (page) setCurrentPage(page);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const verifiedSession =
    session && isEmailVerified(session.user) ? session : null;

  function syncUrl(page: Page) {
    if (page === 'payment-success') return;
    const path = pageToPath(page);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }

  function navigate(page: string) {
    const target = page as Page;

    if (isProtectedPage(target) && !verifiedSession) {
      setAuthRedirect(target);
      setCurrentPage('login');
      syncUrl('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if ((target === 'login' || target === 'signup') && verifiedSession) {
      setAuthRedirect(null);
      setCurrentPage('home');
      syncUrl('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setAuthRedirect(null);
    setCurrentPage(target);
    syncUrl(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateAfterAuth(page: string = 'home') {
    const target = (authRedirect ?? page) as Page;
    setAuthRedirect(null);
    setCurrentPage(target);
    syncUrl(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setAuthRedirect(null);
    setCurrentPage('home');
    syncUrl('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <BillingProvider session={verifiedSession}>
    <div className="app-shell min-h-screen flex flex-col">
      <CheckoutResume />
      <Navbar
        currentPage={currentPage}
        onNavigate={navigate}
        session={verifiedSession}
        onLogout={handleLogout}
      />
      <main className="flex-1">
        {authNotice && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {authNotice}
            </p>
          </div>
        )}
        {currentPage === 'home' && <HomePage onNavigate={navigate} />}
        {currentPage === 'analyzer' && (
          <ProtectedRoute session={verifiedSession} authLoading={authLoading} onNavigate={navigate}>
            <ResumeAnalyzerPage onNavigate={navigate} />
          </ProtectedRoute>
        )}
        {(currentPage === 'interview' || currentPage === 'interview-prep') && (
          <ProtectedRoute session={verifiedSession} authLoading={authLoading} onNavigate={navigate}>
            <InterviewPrepPage onNavigate={navigate} />
          </ProtectedRoute>
        )}
        {currentPage === 'dashboard' && (
          <ProtectedRoute session={verifiedSession} authLoading={authLoading} onNavigate={navigate}>
            <DashboardPage onNavigate={navigate} />
          </ProtectedRoute>
        )}
        {currentPage === 'pricing' && <PricingPage onNavigate={navigate} />}
        {currentPage === 'resume-analyzer' && (
          <ResumeAnalyzerLandingPage onNavigate={navigate} />
        )}
        {currentPage === 'resume-keyword-optimizer' && (
          <ResumeKeywordOptimizerLandingPage onNavigate={navigate} />
        )}
        {currentPage === 'resume-score-checker' && (
          <ResumeScoreCheckerLandingPage onNavigate={navigate} />
        )}
        {currentPage === 'resume-feedback' && (
          <ResumeFeedbackLandingPage onNavigate={navigate} />
        )}
        {currentPage === 'ai-interview-preparation' && (
          <InterviewPrepLandingPage onNavigate={navigate} />
        )}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'contact' && <ContactPage />}
        {currentPage === 'privacy' && <PrivacyPolicyPage />}
        {currentPage === 'terms' && <TermsOfServicePage />}
        {currentPage === 'refund-policy' && <RefundPolicyPage />}
        {currentPage === 'login' && (
          <LoginPage onNavigate={navigate} onAuthSuccess={navigateAfterAuth} />
        )}
        {currentPage === 'signup' && (
          <SignupPage onNavigate={navigate} />
        )}
        {currentPage === 'check-email' && (
          <CheckYourEmailPage onNavigate={navigate} />
        )}
        {currentPage === 'forgot-password' && (
          <ForgotPasswordPage
            onNavigate={navigate}
            initialEmail={sessionStorage.getItem('resuv_forgot_password_email') ?? ''}
          />
        )}
        {currentPage === 'reset-password' && (
          <ResetPasswordPage onNavigate={navigate} />
        )}
        {currentPage === 'payment-success' && (
          <PaymentSuccessPage onNavigate={navigate} />
        )}
      </main>
      <Footer onNavigate={navigate} />
    </div>
    </BillingProvider>
  );
}
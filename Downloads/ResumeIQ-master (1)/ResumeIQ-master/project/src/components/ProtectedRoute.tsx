import type { Session } from '@supabase/supabase-js';
import { Lock } from 'lucide-react';

interface ProtectedRouteProps {
  session: Session | null;
  authLoading: boolean;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export default function ProtectedRoute({
  session,
  authLoading,
  onNavigate,
  children,
}: ProtectedRouteProps) {
  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#3c4a59] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full p-8 text-center flex flex-col items-center gap-5">
          <div className="w-12 h-12 neu-surface rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#3c4a59]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sign in required</h2>
            <p className="text-sm text-primary mt-2 leading-relaxed">
              Log in to access this feature. Create a free account if you don&apos;t have one yet.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="flex-1 btn-primary text-sm"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="flex-1 btn-ghost text-sm"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';

/** Resumes a Pro checkout after login (e.g. from Pricing or Dashboard). */
export default function CheckoutResume() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  usePaywallCheckout({ userId, reportId: null });
  return null;
}

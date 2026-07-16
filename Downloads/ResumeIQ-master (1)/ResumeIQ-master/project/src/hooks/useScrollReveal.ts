import { useEffect } from 'react';

const REVEAL_SELECTOR = '.scroll-reveal';

/**
 * Observes `.scroll-reveal` elements and toggles `is-visible` when in view.
 * Respects prefers-reduced-motion via CSS (elements start visible when reduced).
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);

    if (prefersReduced) {
      nodes.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    nodes.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, deps);
}

'use client';

/**
 * Motion capability hooks for the animated surfaces.
 *
 * Everything decorative on the marketing pages has to answer two questions before
 * it is allowed to run: does the visitor want motion, and can this device actually
 * render it? Getting either wrong is worse than not animating at all — a WebGL
 * backdrop that cannot get a context logs console errors, and an animation that
 * ignores `prefers-reduced-motion` is an accessibility defect.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

/** The server cannot know the visitor's preference, so it assumes "motion is fine". */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the visitor asks for reduced motion.
 *
 * `useSyncExternalStore` is used rather than `useEffect` + `useState` so the first
 * client render matches the server render (no hydration mismatch) while still
 * picking up the real preference immediately afterwards.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Whether this device can give us a WebGL context, probed once on mount. */
export function useWebglAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let context: WebGLRenderingContext | null = null;
    try {
      const canvas = document.createElement('canvas');
      context = (canvas.getContext('webgl2') ??
        canvas.getContext('webgl')) as WebGLRenderingContext | null;
      setAvailable(!!context);
    } catch {
      setAvailable(false);
    } finally {
      // Release the probe context straight away — browsers cap how many live at once.
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }, []);

  return available;
}

/** Whether decorative motion should run at all. */
export function useMotionAllowed(): boolean {
  return !usePrefersReducedMotion();
}

/** Whether a WebGL-backed effect should run: motion allowed *and* renderable. */
export function useBackdropAllowed(): boolean {
  return useMotionAllowed() && useWebglAvailable();
}

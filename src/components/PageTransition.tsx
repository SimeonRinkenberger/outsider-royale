import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';

interface TransitionState {
  isActive: boolean;
  x: number;
  y: number;
  targetPath: string;
}

type Phase = 'idle' | 'mounting' | 'expanding' | 'holding' | 'navigated' | 'shrinking' | 'done';

let triggerTransition: ((x: number, y: number, path: string) => void) | null = null;

export const usePageTransition = () => {
  const navigate = useNavigate();

  const navigateWithTransition = useCallback((path: string, event?: React.MouseEvent) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || !event || !triggerTransition) {
      navigate(path);
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      navigate(path);
      return;
    }

    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    triggerTransition(x, y, path);
  }, [navigate]);

  const navigateWithTransitionFromCoords = useCallback((path: string, x: number, y: number) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || !triggerTransition) {
      navigate(path);
      return;
    }

    triggerTransition(x, y, path);
  }, [navigate]);

  return { navigateWithTransition, navigateWithTransitionFromCoords };
};

export const PageTransitionOverlay = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<TransitionState>({
    isActive: false,
    x: 0,
    y: 0,
    targetPath: '',
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const hasNavigatedRef = useRef(false);
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup helper
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const addTimer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  // Register the global trigger
  useEffect(() => {
    triggerTransition = (x: number, y: number, path: string) => {
      // Reset navigation guard for new transition
      hasNavigatedRef.current = false;
      setState({ isActive: true, x, y, targetPath: path });
      // Start with mounting phase (radius 0), then expand on next frame
      setPhase('mounting');
    };

    return () => {
      triggerTransition = null;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Phase state machine
  useEffect(() => {
    if (phase === 'mounting') {
      // Use requestAnimationFrame to ensure the initial 0 radius is painted first
      const raf = requestAnimationFrame(() => {
        setPhase('expanding');
      });
      return () => cancelAnimationFrame(raf);
    }

    if (phase === 'expanding') {
      // After expand animation completes, hold briefly
      addTimer(() => setPhase('holding'), 600);
    }

    if (phase === 'holding') {
      // Hold to show loading screen
      addTimer(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          console.log('Navigate to Lobby');
          navigate(state.targetPath);
          setPhase('navigated');
        }
      }, 500);
    }

    if (phase === 'navigated') {
      // Give React a frame to mount the new page, then start shrinking
      addTimer(() => setPhase('shrinking'), 100);
    }

    if (phase === 'shrinking') {
      // After shrink animation completes, cleanup
      addTimer(() => setPhase('done'), 650);
    }

    if (phase === 'done') {
      setState(prev => ({ ...prev, isActive: false }));
      setPhase('idle');
    }
  }, [phase, navigate, state.targetPath, addTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  if (!state.isActive) return null;

  // Calculate radius to cover entire viewport from click point
  const maxX = Math.max(state.x, window.innerWidth - state.x);
  const maxY = Math.max(state.y, window.innerHeight - state.y);
  const finalRadius = Math.sqrt(maxX * maxX + maxY * maxY) + 50;

  // Determine the current radius based on phase
  const getRadius = () => {
    if (phase === 'mounting') return 0; // Start at 0
    if (phase === 'shrinking') return 0;
    if (phase === 'expanding' || phase === 'holding' || phase === 'navigated') return finalRadius;
    return 0;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Loading content - centered in viewport, clipped by circle */}
      <div 
        className="fixed inset-0 flex items-center justify-center bg-background"
        style={{
          clipPath: `circle(${getRadius()}px at ${state.x}px ${state.y}px)`,
          transition: 'clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <LoadingScreen text="Loading" />
      </div>
    </div>,
    document.body
  );
};

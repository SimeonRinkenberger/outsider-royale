import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface BackTransitionState {
  isActive: boolean;
  targetPath: string;
}

let triggerBackTransition: ((path: string) => void) | null = null;

export const useBackTransition = () => {
  const navigate = useNavigate();
  const isAnimatingRef = useRef(false);

  const navigateBack = useCallback((path: string) => {
    // Prevent double taps
    if (isAnimatingRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || !triggerBackTransition) {
      navigate(path);
      return;
    }

    isAnimatingRef.current = true;
    triggerBackTransition(path);

    // Reset after animation completes
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 500);
  }, [navigate]);

  const navigateBackWithCallback = useCallback((callback: () => void | Promise<void>, path: string) => {
    // Prevent double taps
    if (isAnimatingRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || !triggerBackTransition) {
      Promise.resolve(callback()).then(() => navigate(path));
      return;
    }

    isAnimatingRef.current = true;
    
    // Execute callback then trigger animation
    Promise.resolve(callback()).then(() => {
      if (triggerBackTransition) {
        triggerBackTransition(path);
      } else {
        navigate(path);
      }
    });

    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 500);
  }, [navigate]);

  return { navigateBack, navigateBackWithCallback };
};

export const BackTransitionOverlay = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<BackTransitionState>({
    isActive: false,
    targetPath: '',
  });
  const [phase, setPhase] = useState<'idle' | 'init' | 'slide' | 'done'>('idle');

  useEffect(() => {
    triggerBackTransition = (path: string) => {
      setState({ isActive: true, targetPath: path });
      setPhase('init');
    };

    return () => {
      triggerBackTransition = null;
    };
  }, []);

  useEffect(() => {
    if (phase === 'init') {
      // Start the slide animation after a frame to ensure initial state renders
      const frameTimer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase('slide');
        });
      });
      return () => cancelAnimationFrame(frameTimer);
    }

    if (phase === 'slide') {
      // Navigate and cleanup after animation
      const navTimer = setTimeout(() => {
        navigate(state.targetPath);
        setPhase('done');
      }, 380);
      return () => clearTimeout(navTimer);
    }

    if (phase === 'done') {
      const cleanupTimer = setTimeout(() => {
        setState({ isActive: false, targetPath: '' });
        setPhase('idle');
      }, 50);
      return () => clearTimeout(cleanupTimer);
    }
  }, [phase, navigate, state.targetPath]);

  if (!state.isActive) return null;

  const isAnimating = phase === 'slide' || phase === 'done';

  return createPortal(
    <div className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden">
      {/* Incoming page (slides in from left) */}
      <div
        className="absolute inset-0 bg-background"
        style={{
          transform: isAnimating ? 'translateX(0)' : 'translateX(-30%)',
          opacity: isAnimating ? 1 : 0.7,
          transition: phase === 'init' ? 'none' : 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />
      {/* Outgoing page overlay (slides out to right) */}
      <div
        className="absolute inset-0 bg-background"
        style={{
          transform: isAnimating ? 'translateX(100%)' : 'translateX(0)',
          transition: phase === 'init' ? 'none' : 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
        }}
      />
    </div>,
    document.body
  );
};

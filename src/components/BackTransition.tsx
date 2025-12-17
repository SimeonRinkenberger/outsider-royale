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
  const [phase, setPhase] = useState<'idle' | 'covering' | 'slide' | 'done'>('idle');

  useEffect(() => {
    triggerBackTransition = (path: string) => {
      setState({ isActive: true, targetPath: path });
      setPhase('covering');
    };

    return () => {
      triggerBackTransition = null;
    };
  }, []);

  useEffect(() => {
    if (phase === 'covering') {
      // Navigate immediately so new page renders underneath
      navigate(state.targetPath);
      // Start slide animation after a frame
      const frameTimer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase('slide');
        });
      });
      return () => cancelAnimationFrame(frameTimer);
    }

    if (phase === 'slide') {
      // Wait for animation to complete
      const timer = setTimeout(() => {
        setPhase('done');
      }, 400);
      return () => clearTimeout(timer);
    }

    if (phase === 'done') {
      setState({ isActive: false, targetPath: '' });
      setPhase('idle');
    }
  }, [phase, navigate, state.targetPath]);

  if (!state.isActive) return null;

  const isSliding = phase === 'slide' || phase === 'done';

  return createPortal(
    <div 
      className="fixed inset-0 z-[9998] overflow-hidden"
      style={{ pointerEvents: phase === 'done' ? 'none' : 'auto' }}
    >
      {/* Outgoing page overlay - slides right to reveal new page underneath */}
      <div
        className="absolute inset-0 bg-background"
        style={{
          transform: isSliding ? 'translateX(100%)' : 'translateX(0)',
          transition: phase === 'covering' ? 'none' : 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          boxShadow: isSliding ? 'none' : '-8px 0 24px rgba(0, 0, 0, 0.12)',
        }}
      />
    </div>,
    document.body
  );
};

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface TransitionState {
  isActive: boolean;
  x: number;
  y: number;
  targetPath: string;
}

let triggerTransition: ((x: number, y: number, path: string) => void) | null = null;

export const usePageTransition = () => {
  const navigate = useNavigate();

  const navigateWithTransition = useCallback((path: string, event?: React.MouseEvent) => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || !event || !triggerTransition) {
      navigate(path);
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    triggerTransition(x, y, path);
  }, [navigate]);

  return { navigateWithTransition };
};

export const PageTransitionOverlay = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<TransitionState>({
    isActive: false,
    x: 0,
    y: 0,
    targetPath: '',
  });
  const [phase, setPhase] = useState<'idle' | 'press' | 'expand' | 'done'>('idle');

  useEffect(() => {
    triggerTransition = (x: number, y: number, path: string) => {
      setState({ isActive: true, x, y, targetPath: path });
      setPhase('press');
    };

    return () => {
      triggerTransition = null;
    };
  }, []);

  useEffect(() => {
    if (phase === 'press') {
      // Brief press effect before expand
      const timer = setTimeout(() => setPhase('expand'), 100);
      return () => clearTimeout(timer);
    }

    if (phase === 'expand') {
      // Navigate after expansion completes
      const timer = setTimeout(() => {
        navigate(state.targetPath);
        setPhase('done');
      }, 500);
      return () => clearTimeout(timer);
    }

    if (phase === 'done') {
      // Cleanup after navigation
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, isActive: false }));
        setPhase('idle');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, navigate, state.targetPath]);

  if (!state.isActive) return null;

  // Calculate radius to cover entire viewport from click point
  const maxX = Math.max(state.x, window.innerWidth - state.x);
  const maxY = Math.max(state.y, window.innerHeight - state.y);
  const finalRadius = Math.sqrt(maxX * maxX + maxY * maxY) + 50;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{
        '--reveal-x': `${state.x}px`,
        '--reveal-y': `${state.y}px`,
        '--final-radius': `${finalRadius}px`,
      } as React.CSSProperties}
    >
      <div
        className={`
          absolute rounded-full bg-background
          transition-all
          ${phase === 'press' ? 'page-transition-press' : ''}
          ${phase === 'expand' || phase === 'done' ? 'page-transition-expand' : ''}
        `}
        style={{
          left: 'var(--reveal-x)',
          top: 'var(--reveal-y)',
          transform: 'translate(-50%, -50%)',
          width: phase === 'idle' || phase === 'press' ? '0px' : `calc(var(--final-radius) * 2)`,
          height: phase === 'idle' || phase === 'press' ? '0px' : `calc(var(--final-radius) * 2)`,
          transition: phase === 'expand' || phase === 'done' 
            ? 'width 500ms cubic-bezier(0.2, 0.8, 0.2, 1), height 500ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            : 'none',
        }}
      />
    </div>,
    document.body
  );
};

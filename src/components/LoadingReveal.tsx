import { useState, useEffect, useRef, ReactNode } from 'react';
import LoadingScreen from './LoadingScreen';

interface LoadingRevealProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
}

const LoadingReveal = ({ isLoading, children, loadingText = 'Loading' }: LoadingRevealProps) => {
  const [phase, setPhase] = useState<'loading' | 'revealing' | 'done'>(isLoading ? 'loading' : 'done');
  const hasRevealedRef = useRef(!isLoading);

  useEffect(() => {
    if (hasRevealedRef.current) return;
    
    if (!isLoading) {
      hasRevealedRef.current = true;
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        setPhase('done');
        return;
      }

      // Start reveal animation
      setPhase('revealing');
    }
  }, [isLoading]);

  useEffect(() => {
    if (phase === 'revealing') {
      const timer = setTimeout(() => {
        setPhase('done');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Done - just render children
  if (phase === 'done') {
    return <>{children}</>;
  }

  // Still loading - show loading screen
  if (phase === 'loading') {
    return <LoadingScreen text={loadingText} />;
  }

  // Revealing phase - show content with shrinking overlay
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Content layer - always visible during reveal */}
      <div className="absolute inset-0">
        {children}
      </div>
      
      {/* Loading overlay that shrinks away */}
      <div className="absolute inset-0 z-50 animate-reveal-shrink">
        <LoadingScreen text={loadingText} />
      </div>
    </div>
  );
};

export default LoadingReveal;

import { useState, useEffect, useRef, ReactNode } from 'react';
import LoadingScreen from './LoadingScreen';

interface LoadingRevealProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
}

const LoadingReveal = ({ isLoading, children, loadingText = 'Loading' }: LoadingRevealProps) => {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'revealing' | 'done'>(isLoading ? 'loading' : 'done');
  const [dimensions, setDimensions] = useState({ centerX: 500, centerY: 500, radius: 1000 });
  const rafRef = useRef<number | null>(null);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    // Calculate dimensions on mount and resize
    const updateDimensions = () => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const maxX = Math.max(centerX, window.innerWidth - centerX);
      const maxY = Math.max(centerY, window.innerHeight - centerY);
      const radius = Math.sqrt(maxX * maxX + maxY * maxY) + 50;
      setDimensions({ centerX, centerY, radius });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    // Once we've revealed, don't go back to loading
    if (hasRevealedRef.current) return;
    
    if (!isLoading && phase === 'loading') {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        hasRevealedRef.current = true;
        setPhase('done');
        return;
      }

      // First render with full coverage, then trigger animation
      setPhase('ready');
    }
  }, [isLoading, phase]);

  useEffect(() => {
    if (phase === 'ready') {
      // Use RAF to ensure the 'ready' state renders before starting animation
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase('revealing');
        });
      });
      
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (phase === 'revealing') {
      hasRevealedRef.current = true;
      const timer = setTimeout(() => {
        setPhase('done');
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // During done phase, just render children normally
  if (phase === 'done') {
    return <>{children}</>;
  }

  // During loading phase, just show loading screen
  if (phase === 'loading') {
    return <LoadingScreen text={loadingText} />;
  }

  const { centerX, centerY, radius } = dimensions;
  const isAnimating = phase === 'revealing';

  // During ready/revealing phase, show both with animation
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Content layer (revealed by shrinking overlay) */}
      <div className="absolute inset-0">
        {children}
      </div>
      
      {/* Loading screen overlay that shrinks to reveal content */}
      <div 
        className="absolute inset-0 z-50 pointer-events-none"
        style={{
          clipPath: isAnimating 
            ? `circle(0px at ${centerX}px ${centerY}px)`
            : `circle(${radius}px at ${centerX}px ${centerY}px)`,
          transition: isAnimating 
            ? 'clip-path 500ms cubic-bezier(0.2, 0.8, 0.2, 1)' 
            : 'none',
        }}
      >
        <LoadingScreen text={loadingText} />
      </div>
    </div>
  );
};

export default LoadingReveal;

import { useState, useEffect, useRef, ReactNode } from 'react';
import LoadingScreen from './LoadingScreen';

interface LoadingRevealProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
}

const LoadingReveal = ({ isLoading, children, loadingText = 'Loading' }: LoadingRevealProps) => {
  const [phase, setPhase] = useState<'loading' | 'revealing' | 'done'>(isLoading ? 'loading' : 'done');
  const [dimensions, setDimensions] = useState({ centerX: 500, centerY: 500, radius: 1000 });
  const hasRevealedRef = useRef(false);

  useEffect(() => {
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
    // Once revealed, don't go back to loading
    if (hasRevealedRef.current) return;
    
    if (!isLoading && phase === 'loading') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        hasRevealedRef.current = true;
        setPhase('done');
        return;
      }

      hasRevealedRef.current = true;
      setPhase('revealing');
    }
  }, [isLoading, phase]);

  useEffect(() => {
    if (phase === 'revealing') {
      const timer = setTimeout(() => {
        setPhase('done');
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (phase === 'done') {
    return <>{children}</>;
  }

  if (phase === 'loading') {
    return <LoadingScreen text={loadingText} />;
  }

  const { centerX, centerY, radius } = dimensions;

  // Revealing phase - animate from full coverage to nothing
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">{children}</div>
      
      <div 
        className="absolute inset-0 z-50 pointer-events-none animate-reveal-shrink"
        style={{
          '--reveal-x': `${centerX}px`,
          '--reveal-y': `${centerY}px`,
          '--reveal-radius': `${radius}px`,
        } as React.CSSProperties}
      >
        <LoadingScreen text={loadingText} />
      </div>
    </div>
  );
};

export default LoadingReveal;

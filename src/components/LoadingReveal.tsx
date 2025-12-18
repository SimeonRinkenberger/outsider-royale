import { useState, useEffect, useRef, ReactNode } from 'react';
import LoadingScreen from './LoadingScreen';

interface LoadingRevealProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
}

const LoadingReveal = ({ isLoading, children, loadingText = 'Loading' }: LoadingRevealProps) => {
  const [showContent, setShowContent] = useState(!isLoading);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDone, setIsDone] = useState(!isLoading);
  const hasRevealedRef = useRef(!isLoading);
  const animationRef = useRef<number | null>(null);

  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') return { centerX: 500, centerY: 500, radius: 1000 };
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxX = Math.max(centerX, window.innerWidth - centerX);
    const maxY = Math.max(centerY, window.innerHeight - centerY);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY) + 50;
    return { centerX, centerY, radius };
  });

  useEffect(() => {
    const updateDimensions = () => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const maxX = Math.max(centerX, window.innerWidth - centerX);
      const maxY = Math.max(centerY, window.innerHeight - centerY);
      const radius = Math.sqrt(maxX * maxX + maxY * maxY) + 50;
      setDimensions({ centerX, centerY, radius });
    };
    
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (hasRevealedRef.current) return;
    
    if (!isLoading) {
      hasRevealedRef.current = true;
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        setShowContent(true);
        setIsDone(true);
        return;
      }

      // Show content first, then start animation on next frame
      setShowContent(true);
      
      animationRef.current = requestAnimationFrame(() => {
        animationRef.current = requestAnimationFrame(() => {
          setIsAnimating(true);
          
          // Clean up after animation
          setTimeout(() => {
            setIsDone(true);
          }, 550);
        });
      });
    }
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLoading]);

  // Once done, just render children
  if (isDone) {
    return <>{children}</>;
  }

  const { centerX, centerY, radius } = dimensions;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Content layer - hidden until reveal starts */}
      <div 
        className="absolute inset-0"
        style={{ 
          visibility: showContent ? 'visible' : 'hidden',
          opacity: showContent ? 1 : 0,
        }}
      >
        {children}
      </div>
      
      {/* Loading overlay with clip-path animation */}
      <div 
        className="absolute inset-0 z-50"
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

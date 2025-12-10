import { useEffect, useState } from 'react';

interface SpotlightRevealProps {
  isActive: boolean;
  children: React.ReactNode;
  onComplete?: () => void;
}

const SpotlightReveal = ({ isActive, children, onComplete }: SpotlightRevealProps) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        setShowContent(true);
        onComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 animate-fade-in" />
      
      {/* Spotlight content */}
      <div className={`relative z-10 ${showContent ? 'animate-spotlight' : 'opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};

export default SpotlightReveal;

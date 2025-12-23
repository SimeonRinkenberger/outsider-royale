import { useState, useEffect } from 'react';
import foxMascot from '@/assets/fox_mascot.png';

interface LoadingScreenProps {
  text?: string;
}

interface LoadingScreenExtendedProps extends LoadingScreenProps {
  isTransitionOverlay?: boolean;
}

const LoadingScreen = ({ text = 'Loading' }: LoadingScreenExtendedProps) => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 relative">
      <img 
        src={foxMascot} 
        alt="Loading" 
        className="w-32 h-32 object-contain"
      />
      <p className="text-muted-foreground">
        {text}<span className="inline-block w-6 text-left">{dots}</span>
      </p>
    </div>
  );
};

export default LoadingScreen;

import { useEffect, useState } from 'react';
import foxMascot from '@/assets/fox_mascot.png';

interface LoadingScreenProps {
  text?: string;
}

const LoadingScreen = ({ text = 'Loading' }: LoadingScreenProps) => {
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
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

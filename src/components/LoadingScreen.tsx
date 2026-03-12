import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 relative">
      <motion.img
        src={foxMascot}
        alt="Loading"
        className="w-32 h-32 object-contain"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      <motion.p
        className="text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        {text}<span className="inline-block w-6 text-left">{dots}</span>
      </motion.p>
    </div>
  );
};

export default LoadingScreen;

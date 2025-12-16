import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer } from 'lucide-react';

interface SpeedRoundTimerProps {
  isActive: boolean;
  duration?: number;
  onTimeUp: () => void;
  isPaused?: boolean;
}

export const SpeedRoundTimer = ({ 
  isActive, 
  duration = 15, 
  onTimeUp,
  isPaused = false 
}: SpeedRoundTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [hasTriggered, setHasTriggered] = useState(false);
  const onTimeUpRef = useRef(onTimeUp);
  
  // Keep callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Reset timer when it becomes active or duration changes
  useEffect(() => {
    if (isActive) {
      setTimeLeft(duration);
      setHasTriggered(false);
    }
  }, [isActive, duration]);

  // Countdown logic - using ref to avoid callback dependency issues
  useEffect(() => {
    if (!isActive || isPaused || hasTriggered) return;

    if (timeLeft <= 0) {
      setHasTriggered(true);
      onTimeUpRef.current();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, isPaused, hasTriggered]);

  if (!isActive) return null;

  const percentage = (timeLeft / duration) * 100;
  const isUrgent = timeLeft <= 5;
  const isCritical = timeLeft <= 3;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`flex items-center gap-3 p-3 rounded-lg border ${
          isCritical 
            ? 'bg-destructive/20 border-destructive/50' 
            : isUrgent 
              ? 'bg-orange-500/20 border-orange-500/50' 
              : 'bg-primary/10 border-primary/30'
        }`}
      >
        <div className="relative">
          <Timer className={`h-5 w-5 ${
            isCritical ? 'text-destructive' : isUrgent ? 'text-orange-500' : 'text-primary'
          } ${isCritical ? 'animate-pulse' : ''}`} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-semibold ${
              isCritical ? 'text-destructive' : isUrgent ? 'text-orange-500' : 'text-foreground'
            }`}>
              Timed Round
            </span>
            <motion.span 
              key={timeLeft}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={`text-lg font-bold tabular-nums ${
                isCritical ? 'text-destructive' : isUrgent ? 'text-orange-500' : 'text-primary'
              }`}
            >
              {timeLeft}s
            </motion.span>
          </div>
          
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isCritical 
                  ? 'bg-destructive' 
                  : isUrgent 
                    ? 'bg-orange-500' 
                    : 'bg-primary'
              }`}
              initial={{ width: '100%' }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

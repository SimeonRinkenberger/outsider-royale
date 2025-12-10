import { useEffect, useRef } from 'react';

export const useTurnChime = (isMyTurn: boolean, hasSubmittedClue: boolean) => {
  const hasPlayedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Play chime when it becomes my turn and I haven't submitted yet
    if (isMyTurn && !hasSubmittedClue && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      playChime();
    }
    
    // Reset when it's no longer my turn
    if (!isMyTurn) {
      hasPlayedRef.current = false;
    }
  }, [isMyTurn, hasSubmittedClue]);

  const playChime = () => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Create a pleasant two-tone chime
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Play two ascending tones
      playTone(523.25, now, 0.2); // C5
      playTone(659.25, now + 0.15, 0.3); // E5
    } catch (error) {
      console.log('Could not play chime:', error);
    }
  };
};

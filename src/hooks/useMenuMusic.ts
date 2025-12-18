import { useEffect, useRef, useState, useCallback } from 'react';

const FADE_DURATION = 800; // ms
const FADE_STEPS = 20;

export const useMenuMusic = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('menuMusicMuted') === 'true');
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem('menuMusicVolume');
    return stored ? parseFloat(stored) : 0.3;
  });
  const [isPlaying, setIsPlaying] = useState(false);

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio('/audio/main_menu.mp3');
    audio.loop = true;
    audio.volume = 0; // Start at 0 for fade-in
    audioRef.current = audio;

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Fade in function
  const fadeIn = useCallback((targetVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    audio.volume = 0;
    audio.currentTime = 0;
    
    audio.play().then(() => {
      setIsPlaying(true);
      const stepSize = targetVolume / FADE_STEPS;
      const stepDuration = FADE_DURATION / FADE_STEPS;
      let currentStep = 0;

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        const newVolume = Math.min(stepSize * currentStep, targetVolume);
        audio.volume = newVolume;

        if (currentStep >= FADE_STEPS) {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
        }
      }, stepDuration);
    }).catch(() => {
      // Autoplay blocked - will try on user interaction
    });
  }, []);

  // Fade out function
  const fadeOut = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const startVolume = audio.volume;
    const stepSize = startVolume / FADE_STEPS;
    const stepDuration = FADE_DURATION / FADE_STEPS;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(startVolume - (stepSize * currentStep), 0);
      audio.volume = newVolume;

      if (currentStep >= FADE_STEPS) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      }
    }, stepDuration);
  }, []);

  // Start music with fade-in when component mounts
  useEffect(() => {
    if (!isMuted) {
      // Small delay to ensure audio is ready
      const timer = setTimeout(() => {
        fadeIn(volume);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // Empty deps - only run on mount

  // Handle user interaction for autoplay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isMuted || isPlaying) return;

    const handleInteraction = () => {
      if (!isPlaying && !isMuted) {
        fadeIn(volume);
      }
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [isMuted, isPlaying, volume, fadeIn]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      localStorage.setItem('menuMusicMuted', String(newMuted));
      
      if (newMuted) {
        fadeOut();
      } else {
        fadeIn(volume);
      }
      
      return newMuted;
    });
  }, [volume, fadeIn, fadeOut]);

  // Handle volume change
  const changeVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem('menuMusicVolume', String(newVolume));
    
    const audio = audioRef.current;
    if (audio && isPlaying) {
      audio.volume = newVolume;
    }
    
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem('menuMusicMuted', 'false');
      if (!isPlaying) {
        fadeIn(newVolume);
      }
    } else if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
      localStorage.setItem('menuMusicMuted', 'true');
    }
  }, [isMuted, isPlaying, fadeIn]);

  // Cleanup with fade-out on unmount
  useEffect(() => {
    return () => {
      fadeOut();
    };
  }, [fadeOut]);

  return {
    isMuted,
    volume,
    isPlaying,
    toggleMute,
    changeVolume,
  };
};

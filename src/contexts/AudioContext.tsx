import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { audioManager, MusicState } from '@/lib/audioManager';

interface AudioContextType {
  musicState: MusicState;
  setMusicState: (state: MusicState) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  duck: (amount?: number, duration?: number) => void;
  isReady: boolean;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [musicState, setMusicStateInternal] = useState<MusicState>(audioManager.getState());
  const [volume, setVolumeInternal] = useState<number>(audioManager.getVolume());
  const [isMuted, setMutedInternal] = useState<boolean>(audioManager.getMuted());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    audioManager.preload().then(() => {
      setIsReady(true);
    });

    const unsubscribeState = audioManager.subscribe((state) => {
      setMusicStateInternal(state);
    });

    const unsubscribeVolume = audioManager.subscribeVolume((vol, muted) => {
      setVolumeInternal(vol);
      setMutedInternal(muted);
    });

    // Gesture-based unlock is now handled internally by audioManager
    // No need for duplicate listeners here

    return () => {
      unsubscribeState();
      unsubscribeVolume();
    };
  }, []);

  const setMusicState = useCallback((state: MusicState) => {
    audioManager.setState(state);
  }, []);

  const setVolume = useCallback((vol: number) => {
    audioManager.setVolume(vol);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    audioManager.setMuted(muted);
  }, []);

  const toggleMute = useCallback(() => {
    audioManager.toggleMute();
  }, []);

  const duck = useCallback((amount?: number, duration?: number) => {
    audioManager.duck(amount, duration);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        musicState,
        setMusicState,
        volume,
        setVolume,
        isMuted,
        setMuted,
        toggleMute,
        duck,
        isReady,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

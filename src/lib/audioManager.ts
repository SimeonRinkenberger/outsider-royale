// Global Audio Manager for Outsider Royale
// State-driven, one track at a time, sequential transitions

export type MusicState = 
  | 'menu' 
  | 'lobby' 
  | 'game_standard' 
  | 'game_timed' 
  | 'win_safe' 
  | 'win_outsider' 
  | 'silent';

interface AudioTrack {
  audio: HTMLAudioElement;
  path: string;
  loop: boolean;
  targetVolume: number;
}

const TRACKS: Record<string, { path: string; loop: boolean; targetVolume: number }> = {
  menu: { path: '/audio/main_menu.mp3', loop: true, targetVolume: 0.45 },
  lobby: { path: '/audio/lobby.mp3', loop: true, targetVolume: 0.45 },
  game_standard: { path: '/audio/game_standard.mp3', loop: true, targetVolume: 0.45 },
  game_timed: { path: '/audio/game_timed.mp3', loop: true, targetVolume: 0.45 },
  win_safe: { path: '/audio/win_safe.mp3', loop: false, targetVolume: 0.65 },
  win_outsider: { path: '/audio/win_outsider.mp3', loop: false, targetVolume: 0.65 },
};

// Check for reduced motion preference
const prefersReducedMotion = () => 
  typeof window !== 'undefined' && 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class AudioManager {
  private tracks: Map<string, AudioTrack> = new Map();
  private currentState: MusicState = 'silent';
  private currentTrackKey: string | null = null;
  private masterVolume: number = 1;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private pendingState: MusicState | null = null;
  private isTransitioning: boolean = false;
  private isEnabled: boolean = false; // Disabled for now - set to true to enable audio
  private listeners: Set<(state: MusicState) => void> = new Set();
  private volumeListeners: Set<(volume: number, muted: boolean) => void> = new Set();

  constructor() {
    // Load preferences from localStorage
    const storedMuted = localStorage.getItem('audioMuted');
    const storedVolume = localStorage.getItem('audioVolume');
    
    this.isMuted = storedMuted === 'true';
    this.masterVolume = storedVolume ? parseFloat(storedVolume) : 1;

    // Handle app visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause current track when app is backgrounded
      this.stopAllTracks();
    } else {
      // Resume when app comes back to foreground
      if (this.currentTrackKey && !this.isMuted && this.currentState !== 'silent') {
        const track = this.tracks.get(this.currentTrackKey);
        if (track) {
          track.audio.play().catch(() => {});
        }
      }
    }
  };

  // Stop all tracks immediately
  private stopAllTracks(): void {
    this.tracks.forEach(track => {
      track.audio.pause();
    });
  }

  // Preload all audio tracks
  async preload(): Promise<void> {
    if (this.isInitialized) return;

    const loadPromises = Object.entries(TRACKS).map(([key, config]) => {
      return new Promise<void>((resolve) => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.loop = config.loop;
        audio.volume = 0;
        
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', () => resolve(), { once: true });
        
        // Handle track ending (for one-shot tracks)
        audio.addEventListener('ended', () => {
          if (!config.loop) {
            this.handleTrackEnded(key);
          }
        });
        
        audio.src = config.path;
        
        this.tracks.set(key, {
          audio,
          path: config.path,
          loop: config.loop,
          targetVolume: config.targetVolume,
        });
      });
    });

    await Promise.all(loadPromises);
    this.isInitialized = true;

    // Play pending state if any
    if (this.pendingState) {
      const pending = this.pendingState;
      this.pendingState = null;
      await this.setState(pending);
    }
  }

  private handleTrackEnded(trackKey: string) {
    // Win tracks return to menu after completion
    if (trackKey === 'win_safe' || trackKey === 'win_outsider') {
      this.setState('menu');
    }
  }

  // Get fade duration based on motion preference
  private getFadeDuration(defaultMs: number): number {
    return prefersReducedMotion() ? 100 : defaultMs;
  }

  // Fade out a track
  private fadeOut(track: AudioTrack, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startVolume = track.audio.volume;
      if (startVolume === 0 || track.audio.paused) {
        track.audio.pause();
        track.audio.currentTime = 0;
        resolve();
        return;
      }

      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
        track.audio.volume = newVolume;

        if (currentStep >= steps) {
          clearInterval(fadeInterval);
          track.audio.pause();
          track.audio.currentTime = 0;
          resolve();
        }
      }, stepDuration);
    });
  }

  // Fade in a track
  private fadeIn(track: AudioTrack, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const targetVolume = this.isMuted ? 0 : track.targetVolume * this.masterVolume;
      
      track.audio.volume = 0;
      track.audio.currentTime = 0;
      
      track.audio.play().then(() => {
        if (targetVolume === 0) {
          resolve();
          return;
        }

        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;

        const fadeInterval = setInterval(() => {
          currentStep++;
          const newVolume = Math.min(targetVolume, volumeStep * currentStep);
          track.audio.volume = newVolume;

          if (currentStep >= steps) {
            clearInterval(fadeInterval);
            resolve();
          }
        }, stepDuration);
      }).catch(() => {
        // Autoplay blocked - will try on user interaction
        resolve();
      });
    });
  }

  // Set the current music state
  async setState(state: MusicState): Promise<void> {
    // Audio disabled for now
    if (!this.isEnabled) return;
    
    // Ignore duplicate state changes
    if (state === this.currentState) return;

    // If not initialized, queue the state change
    if (!this.isInitialized) {
      this.pendingState = state;
      return;
    }

    // If already transitioning, queue this state
    if (this.isTransitioning) {
      this.pendingState = state;
      return;
    }

    this.isTransitioning = true;
    const previousTrackKey = this.currentTrackKey;
    this.currentState = state;
    this.notifyListeners();

    try {
      // Handle silent state
      if (state === 'silent') {
        if (previousTrackKey) {
          const oldTrack = this.tracks.get(previousTrackKey);
          if (oldTrack) {
            await this.fadeOut(oldTrack, this.getFadeDuration(400));
          }
        }
        this.currentTrackKey = null;
        return;
      }

      const newTrack = this.tracks.get(state);
      if (!newTrack) return;

      // ALWAYS stop the old track first
      if (previousTrackKey && previousTrackKey !== state) {
        const oldTrack = this.tracks.get(previousTrackKey);
        if (oldTrack) {
          // Quick fade out for win states, normal for others
          const fadeOutDuration = (state === 'win_safe' || state === 'win_outsider') 
            ? this.getFadeDuration(200) 
            : this.getFadeDuration(300);
          await this.fadeOut(oldTrack, fadeOutDuration);
        }
      }

      // Now start the new track
      this.currentTrackKey = state;
      await this.fadeIn(newTrack, this.getFadeDuration(400));

    } finally {
      this.isTransitioning = false;
      
      // Process any pending state change
      if (this.pendingState && this.pendingState !== this.currentState) {
        const pending = this.pendingState;
        this.pendingState = null;
        await this.setState(pending);
      }
    }
  }

  // Get current state
  getState(): MusicState {
    return this.currentState;
  }

  // Set master volume (0-1)
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audioVolume', String(this.masterVolume));
    
    // Update current track volume
    if (this.currentTrackKey && !this.isMuted) {
      const track = this.tracks.get(this.currentTrackKey);
      if (track) {
        track.audio.volume = track.targetVolume * this.masterVolume;
      }
    }
    
    this.notifyVolumeListeners();
  }

  getVolume(): number {
    return this.masterVolume;
  }

  // Mute/unmute
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    localStorage.setItem('audioMuted', String(muted));
    
    if (this.currentTrackKey) {
      const track = this.tracks.get(this.currentTrackKey);
      if (track) {
        if (muted) {
          track.audio.volume = 0;
        } else {
          track.audio.volume = track.targetVolume * this.masterVolume;
        }
      }
    }
    
    this.notifyVolumeListeners();
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  toggleMute(): void {
    this.setMuted(!this.isMuted);
  }

  // Duck volume temporarily (for important events)
  async duck(duckAmount: number = 0.2, durationMs: number = 1000): Promise<void> {
    if (!this.currentTrackKey || this.isMuted) return;

    const track = this.tracks.get(this.currentTrackKey);
    if (!track) return;

    const originalVolume = track.audio.volume;
    const duckedVolume = originalVolume * (1 - duckAmount);

    track.audio.volume = duckedVolume;

    setTimeout(() => {
      if (this.currentTrackKey && !this.isMuted) {
        const currentTrack = this.tracks.get(this.currentTrackKey);
        if (currentTrack) {
          currentTrack.audio.volume = originalVolume;
        }
      }
    }, durationMs);
  }

  // Subscribe to state changes
  subscribe(listener: (state: MusicState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Subscribe to volume changes
  subscribeVolume(listener: (volume: number, muted: boolean) => void): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentState));
  }

  private notifyVolumeListeners(): void {
    this.volumeListeners.forEach(listener => listener(this.masterVolume, this.isMuted));
  }

  // Try to play (for user interaction unlock)
  async tryPlay(): Promise<void> {
    if (this.currentTrackKey && !this.isMuted) {
      const track = this.tracks.get(this.currentTrackKey);
      if (track) {
        try {
          await track.audio.play();
        } catch {
          // Still blocked
        }
      }
    }
  }

  // Cleanup
  destroy(): void {
    this.stopAllTracks();
    this.tracks.forEach(track => {
      track.audio.src = '';
    });
    this.tracks.clear();
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

// Singleton instance with HMR protection
let audioManagerInstance: AudioManager | null = null;

// Clean up old instance on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (audioManagerInstance) {
      audioManagerInstance.destroy();
      audioManagerInstance = null;
    }
  });
}

export const audioManager = (() => {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
})();

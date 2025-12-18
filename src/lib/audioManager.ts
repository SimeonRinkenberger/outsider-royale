// Global Audio Manager for Outsider Royale
// State-driven, one track at a time, seamless looping, smooth crossfades

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
  private currentTrack: AudioTrack | null = null;
  private fadeInterval: NodeJS.Timeout | null = null;
  private masterVolume: number = 1;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private pendingState: MusicState | null = null;
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
      this.currentTrack?.audio.pause();
    } else {
      // Resume when app comes back to foreground
      if (this.currentTrack && !this.isMuted && this.currentState !== 'silent') {
        this.currentTrack.audio.play().catch(() => {});
      }
    }
  };

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
      this.setState(this.pendingState);
      this.pendingState = null;
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

  // Fade out current track
  private fadeOut(track: AudioTrack, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
      }

      const startVolume = track.audio.volume;
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      this.fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
        track.audio.volume = newVolume;

        if (currentStep >= steps) {
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
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
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
        }

        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;

        this.fadeInterval = setInterval(() => {
          currentStep++;
          const newVolume = Math.min(targetVolume, volumeStep * currentStep);
          track.audio.volume = newVolume;

          if (currentStep >= steps) {
            if (this.fadeInterval) {
              clearInterval(this.fadeInterval);
              this.fadeInterval = null;
            }
            resolve();
          }
        }, stepDuration);
      }).catch(() => {
        // Autoplay blocked - will try on user interaction
        resolve();
      });
    });
  }

  // Crossfade between tracks
  private async crossfade(fromTrack: AudioTrack | null, toTrack: AudioTrack, crossfadeDuration: number): Promise<void> {
    const fadeOutDuration = this.getFadeDuration(crossfadeDuration);
    const fadeInDuration = this.getFadeDuration(400);

    // Start fade in slightly before fade out completes for overlap
    const overlapMs = Math.min(fadeOutDuration * 0.5, 150);

    if (fromTrack) {
      // Start fade out
      const fadeOutPromise = this.fadeOut(fromTrack, fadeOutDuration);
      
      // Wait a bit then start fade in
      await new Promise(resolve => setTimeout(resolve, fadeOutDuration - overlapMs));
      await this.fadeIn(toTrack, fadeInDuration);
      await fadeOutPromise;
    } else {
      await this.fadeIn(toTrack, fadeInDuration);
    }
  }

  // Set the current music state
  async setState(state: MusicState): Promise<void> {
    // Ignore duplicate state changes
    if (state === this.currentState) return;

    // If not initialized, queue the state change
    if (!this.isInitialized) {
      this.pendingState = state;
      return;
    }

    const previousState = this.currentState;
    this.currentState = state;
    this.notifyListeners();

    // Handle silent state
    if (state === 'silent') {
      if (this.currentTrack) {
        await this.fadeOut(this.currentTrack, this.getFadeDuration(400));
        this.currentTrack = null;
      }
      return;
    }

    const newTrack = this.tracks.get(state);
    if (!newTrack) return;

    // Win states: immediate fade out (200ms) then play win music
    if (state === 'win_safe' || state === 'win_outsider') {
      if (this.currentTrack) {
        await this.fadeOut(this.currentTrack, this.getFadeDuration(200));
      }
      this.currentTrack = newTrack;
      await this.fadeIn(newTrack, this.getFadeDuration(300));
      return;
    }

    // Normal crossfade for background music
    const crossfadeDuration = this.getFadeDuration(300);
    await this.crossfade(this.currentTrack, newTrack, crossfadeDuration);
    this.currentTrack = newTrack;
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
    if (this.currentTrack && !this.isMuted) {
      this.currentTrack.audio.volume = this.currentTrack.targetVolume * this.masterVolume;
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
    
    if (this.currentTrack) {
      if (muted) {
        this.currentTrack.audio.volume = 0;
      } else {
        this.currentTrack.audio.volume = this.currentTrack.targetVolume * this.masterVolume;
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
    if (!this.currentTrack || this.isMuted) return;

    const originalVolume = this.currentTrack.audio.volume;
    const duckedVolume = originalVolume * (1 - duckAmount);

    // Quick fade to ducked volume
    this.currentTrack.audio.volume = duckedVolume;

    // Restore after duration
    setTimeout(() => {
      if (this.currentTrack && !this.isMuted) {
        this.currentTrack.audio.volume = originalVolume;
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
    if (this.currentTrack && !this.isMuted) {
      try {
        await this.currentTrack.audio.play();
      } catch {
        // Still blocked
      }
    }
  }

  // Cleanup
  destroy(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }
    
    this.tracks.forEach(track => {
      track.audio.pause();
      track.audio.src = '';
    });
    this.tracks.clear();
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

// Singleton instance
export const audioManager = new AudioManager();

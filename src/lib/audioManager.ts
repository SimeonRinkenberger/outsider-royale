// Global Audio Manager for Outsider Royale
// Uses Web Audio API for cross-platform compatibility (web + iOS/Android native)

export type MusicState = 
  | 'menu' 
  | 'lobby' 
  | 'game_standard' 
  | 'game_timed' 
  | 'win_safe' 
  | 'win_outsider' 
  | 'silent';

interface DecodedTrack {
  buffer: AudioBuffer;
  loop: boolean;
  targetVolume: number;
}

interface ActivePlayback {
  source: AudioBufferSourceNode;
  gain: GainNode;
  trackKey: string;
}

const TRACKS: Record<string, { path: string; loop: boolean; targetVolume: number }> = {
  menu: { path: '/audio/main_menu.mp3', loop: true, targetVolume: 0.45 },
  lobby: { path: '/audio/lobby.mp3', loop: true, targetVolume: 0.45 },
  game_standard: { path: '/audio/game_standard.mp3', loop: true, targetVolume: 0.45 },
  game_timed: { path: '/audio/game_timed.mp3', loop: true, targetVolume: 0.45 },
  win_safe: { path: '/audio/win_safe.mp3', loop: false, targetVolume: 0.65 },
  win_outsider: { path: '/audio/win_outsider.mp3', loop: false, targetVolume: 0.65 },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class AudioManager {
  private ctx: AudioContext | null = null;
  private decodedTracks: Map<string, DecodedTrack> = new Map();
  private active: ActivePlayback | null = null;
  private currentState: MusicState = 'silent';
  private masterVolume: number = 1;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private pendingState: MusicState | null = null;
  private isTransitioning: boolean = false;
  private isEnabled: boolean = true;
  private listeners: Set<(state: MusicState) => void> = new Set();
  private volumeListeners: Set<(volume: number, muted: boolean) => void> = new Set();

  constructor() {
    const storedMuted = localStorage.getItem('audioMuted');
    const storedVolume = localStorage.getItem('audioVolume');
    this.isMuted = storedMuted === 'true';
    this.masterVolume = storedVolume ? parseFloat(storedVolume) : 0.5;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  // Lazily create or resume the AudioContext (must happen after user gesture)
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private handleVisibilityChange = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      this.ctx.suspend().catch(() => {});
    } else {
      if (this.currentState !== 'silent' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
    }
  };

  // Preload all audio tracks by fetching + decoding to AudioBuffers
  async preload(): Promise<void> {
    if (!this.isEnabled || this.isInitialized) {
      this.isInitialized = true;
      return;
    }

    // Create context early (may be suspended until user gesture)
    const ctx = this.ensureContext();

    const loadPromises = Object.entries(TRACKS).map(async ([key, config]) => {
      try {
        const response = await fetch(config.path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.decodedTracks.set(key, {
          buffer: audioBuffer,
          loop: config.loop,
          targetVolume: config.targetVolume,
        });
      } catch (err) {
        console.warn(`[AudioManager] Failed to load ${key}:`, err);
      }
    });

    await Promise.all(loadPromises);
    this.isInitialized = true;

    if (this.pendingState) {
      const pending = this.pendingState;
      this.pendingState = null;
      await this.setState(pending);
    }
  }

  private getFadeDuration(defaultMs: number): number {
    return prefersReducedMotion() ? 100 : defaultMs;
  }

  // Start playing a decoded track, returns the active playback handle
  private startPlayback(key: string): ActivePlayback | null {
    const track = this.decodedTracks.get(key);
    if (!track) return null;

    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = track.buffer;
    source.loop = track.loop;
    gain.gain.value = 0; // start silent for fade-in

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    // Handle one-shot track endings
    if (!track.loop) {
      source.addEventListener('ended', () => {
        if (this.active?.trackKey === key) {
          this.active = null;
          // Win tracks return to menu
          if (key === 'win_safe' || key === 'win_outsider') {
            this.setState('menu');
          }
        }
      });
    }

    return { source, gain, trackKey: key };
  }

  // Fade a gain node from current value to target over duration
  private fade(gain: GainNode, targetValue: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.ctx;
      if (!ctx) { resolve(); return; }
      const now = ctx.currentTime;
      const endTime = now + durationMs / 1000;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(targetValue, endTime);
      setTimeout(resolve, durationMs);
    });
  }

  // Stop the active playback with optional fade
  private async stopActive(fadeDurationMs: number): Promise<void> {
    if (!this.active) return;
    const { source, gain } = this.active;
    this.active = null;
    try {
      await this.fade(gain, 0, fadeDurationMs);
      source.stop();
      source.disconnect();
      gain.disconnect();
    } catch {
      // source may already be stopped
    }
  }

  async setState(state: MusicState): Promise<void> {
    if (!this.isEnabled) return;
    if (state === this.currentState) return;

    if (!this.isInitialized) {
      this.pendingState = state;
      return;
    }

    if (this.isTransitioning) {
      this.pendingState = state;
      return;
    }

    this.isTransitioning = true;
    this.currentState = state;
    this.notifyListeners();

    try {
      if (state === 'silent') {
        await this.stopActive(this.getFadeDuration(400));
        return;
      }

      const track = this.decodedTracks.get(state);
      if (!track) return;

      // Stop old track
      if (this.active && this.active.trackKey !== state) {
        const fadeOutMs = (state === 'win_safe' || state === 'win_outsider')
          ? this.getFadeDuration(200)
          : this.getFadeDuration(300);
        await this.stopActive(fadeOutMs);
      }

      // Start new track
      const playback = this.startPlayback(state);
      if (!playback) return;
      this.active = playback;

      const targetVol = this.isMuted ? 0 : track.targetVolume * this.masterVolume;
      await this.fade(playback.gain, targetVol, this.getFadeDuration(400));

    } finally {
      this.isTransitioning = false;
      if (this.pendingState && this.pendingState !== this.currentState) {
        const pending = this.pendingState;
        this.pendingState = null;
        await this.setState(pending);
      }
    }
  }

  getState(): MusicState { return this.currentState; }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audioVolume', String(this.masterVolume));
    if (this.active && !this.isMuted) {
      const track = this.decodedTracks.get(this.active.trackKey);
      if (track) {
        this.active.gain.gain.value = track.targetVolume * this.masterVolume;
      }
    }
    this.notifyVolumeListeners();
  }

  getVolume(): number { return this.masterVolume; }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    localStorage.setItem('audioMuted', String(muted));
    if (this.active) {
      const track = this.decodedTracks.get(this.active.trackKey);
      if (track) {
        this.active.gain.gain.value = muted ? 0 : track.targetVolume * this.masterVolume;
      }
    }
    this.notifyVolumeListeners();
  }

  getMuted(): boolean { return this.isMuted; }
  toggleMute(): void { this.setMuted(!this.isMuted); }

  async duck(duckAmount: number = 0.2, durationMs: number = 1000): Promise<void> {
    if (!this.active || this.isMuted) return;
    const track = this.decodedTracks.get(this.active.trackKey);
    if (!track) return;

    const originalVol = track.targetVolume * this.masterVolume;
    const duckedVol = originalVol * (1 - duckAmount);

    this.active.gain.gain.value = duckedVol;
    setTimeout(() => {
      if (this.active && !this.isMuted) {
        const t = this.decodedTracks.get(this.active.trackKey);
        if (t) this.active.gain.gain.value = t.targetVolume * this.masterVolume;
      }
    }, durationMs);
  }

  subscribe(listener: (state: MusicState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeVolume(listener: (volume: number, muted: boolean) => void): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.currentState));
  }
  private notifyVolumeListeners(): void {
    this.volumeListeners.forEach(l => l(this.masterVolume, this.isMuted));
  }

  async tryPlay(): Promise<void> {
    // Resume AudioContext on user gesture
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    // If we have a pending state that couldn't play, retry
    if (this.currentState !== 'silent' && !this.active && !this.isMuted) {
      await this.setState(this.currentState);
    }
  }

  destroy(): void {
    if (this.active) {
      try {
        this.active.source.stop();
        this.active.source.disconnect();
        this.active.gain.disconnect();
      } catch {}
      this.active = null;
    }
    this.decodedTracks.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

// Singleton with HMR protection
let audioManagerInstance: AudioManager | null = null;

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

// Global Audio Manager for Outsider Royale
// Uses Web Audio API with iOS/Android-specific workarounds for Capacitor builds

import { Capacitor } from '@capacitor/core';

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

const TAG = '[AudioManager]';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class AudioManager {
  private ctx: AudioContext | null = null;
  private rawBuffers: Map<string, ArrayBuffer> = new Map();
  private decodedTracks: Map<string, DecodedTrack> = new Map();
  private active: ActivePlayback | null = null;
  private currentState: MusicState = 'silent';
  private masterVolume: number = 1;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private pendingState: MusicState | null = null;
  private isTransitioning: boolean = false;
  private isEnabled: boolean = true;
  private unlocked: boolean = false;
  private listeners: Set<(state: MusicState) => void> = new Set();
  private volumeListeners: Set<(volume: number, muted: boolean) => void> = new Set();
  private gestureEvents = ['pointerdown', 'touchstart', 'click', 'keydown'] as const;
  private appStateCleanup: (() => void) | null = null;

  constructor() {
    const storedMuted = localStorage.getItem('audioMuted');
    const storedVolume = localStorage.getItem('audioVolume');
    this.isMuted = storedMuted === 'true';
    this.masterVolume = storedVolume ? parseFloat(storedVolume) : 0.5;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      // Register persistent gesture listeners for iOS unlock
      for (const ev of this.gestureEvents) {
        document.addEventListener(ev, this.handleUserGesture, { capture: true });
      }
    }

    // Set up Capacitor native lifecycle hooks
    this.setupNativeLifecycle();
  }

  private async setupNativeLifecycle(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appStateChange', (state: { isActive: boolean }) => {
        console.log(TAG, 'appStateChange isActive=', state.isActive);
        if (state.isActive) {
          this.handleResume();
        } else {
          this.handleSuspend();
        }
      });
      this.appStateCleanup = () => handle.remove();
    } catch (e) {
      console.warn(TAG, 'Could not set up native lifecycle:', e);
    }
  }

  // --- iOS unlock: play a silent buffer on first gesture to fully unlock AudioContext ---
  private handleUserGesture = async () => {
    if (this.unlocked && this.ctx?.state === 'running') return;
    
    console.log(TAG, 'User gesture detected, attempting unlock. ctx state=', this.ctx?.state ?? 'null');
    
    try {
      const ctx = this.ensureContext();
      
      // Resume if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log(TAG, 'resume() called, state=', ctx.state);
      }

      // Play a tiny silent buffer to fully unlock iOS audio
      if (!this.unlocked) {
        const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = silentBuffer;
        src.connect(ctx.destination);
        src.start(0);
        src.stop(ctx.currentTime + 0.001);
        this.unlocked = true;
        console.log(TAG, 'Silent buffer played — audio unlocked');
      }

      // If we have a desired state, try to play it
      if (this.currentState !== 'silent' && !this.isMuted && !this.active) {
        const desired = this.currentState;
        this.currentState = 'silent'; // reset so setState doesn't bail
        await this.setState(desired);
      } else if (this.active && this.active.gain.gain.value === 0 && !this.isMuted) {
        // Fix gain stuck at 0 after resume
        const track = this.decodedTracks.get(this.active.trackKey);
        if (track) {
          this.active.gain.gain.value = track.targetVolume * this.masterVolume;
          console.log(TAG, 'Restored gain that was stuck at 0');
        }
      }
    } catch (err) {
      console.warn(TAG, 'Unlock attempt failed:', err);
    }
  };

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log(TAG, 'AudioContext created, state=', this.ctx.state, 'sampleRate=', this.ctx.sampleRate);
    }
    return this.ctx;
  }

  // --- Visibility change (works on both web and native) ---
  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.handleSuspend();
    } else {
      this.handleResume();
    }
  };

  private handleSuspend(): void {
    if (!this.ctx) return;
    console.log(TAG, 'Suspending audio (background)');
    this.ctx.suspend().catch(() => {});
  }

  private async handleResume(): Promise<void> {
    if (!this.ctx) return;
    console.log(TAG, 'Resuming audio (foreground), ctx state=', this.ctx.state);

    // iOS WKWebView workaround: suspend → resume cycle
    // Just calling resume() often fails; the suspend→resume trick is more reliable
    try {
      if (this.ctx.state !== 'running') {
        await this.ctx.suspend();
        await new Promise(r => setTimeout(r, 50));
        await this.ctx.resume();
        console.log(TAG, 'suspend→resume cycle complete, state=', this.ctx.state);
      }
    } catch (e) {
      console.warn(TAG, 'Resume cycle failed:', e);
    }

    // If we had active playback but it died, restart it
    if (this.currentState !== 'silent' && !this.isMuted) {
      if (!this.active) {
        console.log(TAG, 'No active playback after resume, restarting', this.currentState);
        const desired = this.currentState;
        this.currentState = 'silent';
        await this.setState(desired);
      } else {
        // Ensure gain isn't stuck at 0
        const track = this.decodedTracks.get(this.active.trackKey);
        if (track) {
          const expectedGain = track.targetVolume * this.masterVolume;
          if (this.active.gain.gain.value === 0 || Math.abs(this.active.gain.gain.value - expectedGain) > 0.01) {
            this.active.gain.gain.value = expectedGain;
            console.log(TAG, 'Corrected gain after resume to', expectedGain);
          }
        }
      }
    }
  }

  // --- Preload raw buffers (no AudioContext needed) ---
  async preload(): Promise<void> {
    if (!this.isEnabled || this.isInitialized) {
      this.isInitialized = true;
      return;
    }

    const loadPromises = Object.entries(TRACKS).map(async ([key, config]) => {
      try {
        // Use absolute URL to handle Capacitor file:// origin correctly
        const url = new URL(config.path, window.location.origin).href;
        console.log(TAG, `Fetching ${key} from ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(TAG, `Fetch failed for ${key}: ${response.status} ${response.statusText}`);
          return;
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('audio') && !contentType.includes('octet-stream') && !contentType.includes('mpeg')) {
          console.warn(TAG, `Unexpected content-type for ${key}: ${contentType}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength < 100) {
          console.warn(TAG, `Buffer for ${key} is suspiciously small: ${arrayBuffer.byteLength} bytes`);
          return;
        }
        this.rawBuffers.set(key, arrayBuffer);
        console.log(TAG, `Fetched ${key}: ${arrayBuffer.byteLength} bytes`);
      } catch (err) {
        console.warn(TAG, `Failed to fetch ${key}:`, err);
      }
    });

    await Promise.all(loadPromises);
    this.isInitialized = true;
    console.log(TAG, 'Preloaded raw buffers for', this.rawBuffers.size, '/', Object.keys(TRACKS).length, 'tracks');

    if (this.pendingState) {
      const pending = this.pendingState;
      this.pendingState = null;
      await this.setState(pending);
    }
  }

  // Decode a raw buffer into an AudioBuffer on demand
  private async decodeTrack(key: string): Promise<DecodedTrack | null> {
    if (this.decodedTracks.has(key)) return this.decodedTracks.get(key)!;
    
    const raw = this.rawBuffers.get(key);
    const config = TRACKS[key];
    if (!raw || !config) {
      console.warn(TAG, `Cannot decode ${key}: raw=${!!raw} config=${!!config}`);
      return null;
    }

    try {
      const ctx = this.ensureContext();
      console.log(TAG, `Decoding ${key} (${raw.byteLength} bytes)...`);
      const audioBuffer = await ctx.decodeAudioData(raw.slice(0));
      const decoded: DecodedTrack = {
        buffer: audioBuffer,
        loop: config.loop,
        targetVolume: config.targetVolume,
      };
      this.decodedTracks.set(key, decoded);
      console.log(TAG, `Decoded ${key}: duration=${audioBuffer.duration.toFixed(1)}s channels=${audioBuffer.numberOfChannels}`);
      return decoded;
    } catch (err) {
      console.warn(TAG, `Failed to decode ${key}:`, err);
      return null;
    }
  }

  private getFadeDuration(defaultMs: number): number {
    return prefersReducedMotion() ? 100 : defaultMs;
  }

  private startPlayback(key: string): ActivePlayback | null {
    const track = this.decodedTracks.get(key);
    if (!track) return null;

    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      console.warn(TAG, `startPlayback(${key}): ctx not running (state=${ctx.state}), attempting resume`);
      ctx.resume().catch(() => {});
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = track.buffer;
    source.loop = track.loop;
    gain.gain.value = 0; // start silent for fade-in

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    console.log(TAG, `play started: ${key}, loop=${track.loop}`);

    if (!track.loop) {
      source.addEventListener('ended', () => {
        if (this.active?.trackKey === key) {
          this.active = null;
          if (key === 'win_safe' || key === 'win_outsider') {
            this.setState('menu');
          }
        }
      });
    }

    return { source, gain, trackKey: key };
  }

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
      console.log(TAG, `setState(${state}) deferred — not yet initialized`);
      return;
    }

    if (this.isTransitioning) {
      this.pendingState = state;
      return;
    }

    this.isTransitioning = true;
    this.currentState = state;
    this.notifyListeners();
    console.log(TAG, `setState → ${state}`);

    try {
      if (state === 'silent') {
        await this.stopActive(this.getFadeDuration(400));
        return;
      }

      const track = await this.decodeTrack(state);
      if (!track) {
        console.warn(TAG, `No track decoded for ${state}`);
        return;
      }

      if (this.active && this.active.trackKey !== state) {
        const fadeOutMs = (state === 'win_safe' || state === 'win_outsider')
          ? this.getFadeDuration(200)
          : this.getFadeDuration(300);
        await this.stopActive(fadeOutMs);
      }

      const playback = this.startPlayback(state);
      if (!playback) return;
      this.active = playback;

      const targetVol = this.isMuted ? 0 : track.targetVolume * this.masterVolume;
      await this.fade(playback.gain, targetVol, this.getFadeDuration(400));
      console.log(TAG, `Fade-in complete for ${state}, gain=${targetVol.toFixed(3)}`);

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

  // Called from AudioContext on user gesture — kept for compat but gesture handling
  // is now internal via persistent listeners
  async tryPlay(): Promise<void> {
    await this.handleUserGesture();
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

  destroy(): void {
    if (this.active) {
      try {
        this.active.source.stop();
        this.active.source.disconnect();
        this.active.gain.disconnect();
      } catch {}
      this.active = null;
    }
    this.rawBuffers.clear();
    this.decodedTracks.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      for (const ev of this.gestureEvents) {
        document.removeEventListener(ev, this.handleUserGesture, { capture: true });
      }
    }
    this.appStateCleanup?.();
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

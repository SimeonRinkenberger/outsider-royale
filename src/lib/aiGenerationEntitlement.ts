/**
 * AI Generation Entitlement Helpers
 * 
 * Tracks AI category generation usage with free tier (2 free) + Pro unlimited.
 * Cached locally, refreshed on app start and after purchases.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Constants
export const AI_FREE_GENERATION_LIMIT = 2;
const AI_GENERATION_STORAGE_KEY = 'ai_generation_usage';

// State interface
export interface AIGenerationState {
  aiGenerationsUsed: number;
  lastSyncedAt: string | null;
}

// Default state
const DEFAULT_STATE: AIGenerationState = {
  aiGenerationsUsed: 0,
  lastSyncedAt: null,
};

// In-memory cache
let cachedState: AIGenerationState = { ...DEFAULT_STATE };
let updateListeners: ((state: AIGenerationState) => void)[] = [];

/**
 * Check if on native platform
 */
function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Load cached state from storage
 */
export async function loadAIGenerationState(): Promise<AIGenerationState> {
  try {
    if (isNativePlatform()) {
      const result = await Preferences.get({ key: AI_GENERATION_STORAGE_KEY });
      if (result.value) {
        cachedState = JSON.parse(result.value);
        return cachedState;
      }
    } else {
      const stored = localStorage.getItem(AI_GENERATION_STORAGE_KEY);
      if (stored) {
        cachedState = JSON.parse(stored);
        return cachedState;
      }
    }
  } catch (error) {
    console.warn('[AIGenerationEntitlement] Failed to load cached state:', error);
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save state to storage
 */
async function saveState(state: AIGenerationState): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    if (isNativePlatform()) {
      await Preferences.set({ key: AI_GENERATION_STORAGE_KEY, value: serialized });
    } else {
      localStorage.setItem(AI_GENERATION_STORAGE_KEY, serialized);
    }
  } catch (error) {
    console.warn('[AIGenerationEntitlement] Failed to save state:', error);
  }
}

/**
 * Notify listeners of state changes
 */
function notifyListeners(state: AIGenerationState): void {
  updateListeners.forEach(listener => {
    try {
      listener(state);
    } catch (error) {
      console.error('[AIGenerationEntitlement] Listener error:', error);
    }
  });
}

/**
 * Update state and persist
 */
async function updateState(newState: AIGenerationState): Promise<void> {
  cachedState = newState;
  await saveState(newState);
  notifyListeners(newState);
}

/**
 * Get current cached state
 */
export function getAIGenerationState(): AIGenerationState {
  return { ...cachedState };
}

/**
 * Get remaining free generations
 */
export function getFreeGenerationsRemaining(): number {
  return Math.max(0, AI_FREE_GENERATION_LIMIT - cachedState.aiGenerationsUsed);
}

/**
 * Check if user can generate AI categories
 * 
 * @param isPro - Whether user has Pro subscription
 * @returns Whether generation is allowed
 */
export function canUseAIGeneration(isPro: boolean): boolean {
  // Pro users have unlimited
  if (isPro) return true;
  
  // Free users limited to free tier
  return cachedState.aiGenerationsUsed < AI_FREE_GENERATION_LIMIT;
}

/**
 * Increment AI generation usage locally
 * Should only be called after successful generation
 */
export async function incrementAIGenerationUsage(): Promise<void> {
  const newState: AIGenerationState = {
    ...cachedState,
    aiGenerationsUsed: cachedState.aiGenerationsUsed + 1,
    lastSyncedAt: new Date().toISOString(),
  };
  await updateState(newState);
}

/**
 * Sync state from server response
 */
export async function syncAIGenerationState(serverUsage: number): Promise<void> {
  const newState: AIGenerationState = {
    aiGenerationsUsed: serverUsage,
    lastSyncedAt: new Date().toISOString(),
  };
  await updateState(newState);
}

/**
 * Grant one free generation (after consumable purchase)
 * This temporarily allows one more generation
 */
export async function grantOneGeneration(): Promise<void> {
  // Decrement usage by 1 to effectively grant 1 generation
  const newState: AIGenerationState = {
    ...cachedState,
    aiGenerationsUsed: Math.max(0, cachedState.aiGenerationsUsed - 1),
    lastSyncedAt: new Date().toISOString(),
  };
  await updateState(newState);
}

/**
 * Subscribe to state updates
 */
export function onAIGenerationStateUpdate(
  listener: (state: AIGenerationState) => void
): () => void {
  updateListeners.push(listener);
  return () => {
    updateListeners = updateListeners.filter(l => l !== listener);
  };
}

/**
 * Reset state (for testing/logout)
 */
export async function resetAIGenerationState(): Promise<void> {
  await updateState({ ...DEFAULT_STATE });
}

// Debug helpers (dev mode only)
export const debugAIGeneration = {
  getState: () => ({ ...cachedState }),
  setUsage: async (usage: number) => {
    if (process.env.NODE_ENV !== 'production') {
      await updateState({
        ...cachedState,
        aiGenerationsUsed: usage,
        lastSyncedAt: new Date().toISOString(),
      });
    }
  },
};

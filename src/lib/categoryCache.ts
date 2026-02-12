/**
 * Offline-first Category Cache
 * 
 * Syncs word categories from the database on app load when online,
 * and stores them locally for offline in-person gameplay.
 * 
 * Flow:
 * 1. On app startup, check if online
 * 2. If online, fetch all words from DB grouped by category and cache locally
 * 3. For in-person mode, always use the local cache (works offline)
 * 4. For online mode, still uses RPCs (server handles word selection)
 */

import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'outsider-royale-word-cache';
const CACHE_TIMESTAMP_KEY = 'outsider-royale-word-cache-ts';

export interface CachedWord {
  text: string;
  category: string;
}

export interface WordCache {
  categories: Record<string, string[]>; // category -> words[]
  lastSynced: string; // ISO timestamp
}

/**
 * Get the cached words from localStorage
 */
export function getCachedWords(): WordCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as WordCache;
  } catch {
    return null;
  }
}

/**
 * Save words to local cache
 */
function saveToCache(cache: WordCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, cache.lastSynced);
}

/**
 * Sync categories from the database.
 * Fetches ALL words and stores them locally.
 * Returns true if sync was successful.
 */
export async function syncCategories(): Promise<boolean> {
  try {
    // Fetch all words from DB (paginated to handle >1000 rows)
    const allWords: CachedWord[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('words')
        .select('text, category')
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Failed to sync categories:', error);
        return false;
      }

      if (data && data.length > 0) {
        allWords.push(...data.map(w => ({ text: w.text, category: w.category })));
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    if (allWords.length === 0) {
      console.warn('No words returned from database');
      return false;
    }

    // Group by category
    const categories: Record<string, string[]> = {};
    for (const word of allWords) {
      if (!categories[word.category]) {
        categories[word.category] = [];
      }
      categories[word.category].push(word.text);
    }

    const cache: WordCache = {
      categories,
      lastSynced: new Date().toISOString(),
    };

    saveToCache(cache);
    console.log(`Category cache synced: ${allWords.length} words across ${Object.keys(categories).length} categories`);
    return true;
  } catch (error) {
    console.error('Category sync failed:', error);
    return false;
  }
}

/**
 * Get a random word from cached categories (for in-person mode)
 */
export function getRandomWordFromCache(
  selectedCategories: string[]
): { text: string; category: string } | null {
  const cache = getCachedWords();
  if (!cache) return null;

  // Build pool of words from selected categories
  const pool: { text: string; category: string }[] = [];
  for (const cat of selectedCategories) {
    const words = cache.categories[cat];
    if (words) {
      for (const word of words) {
        pool.push({ text: word, category: cat });
      }
    }
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get a random word from cache excluding a specific word (for imposter word)
 */
export function getImposterWordFromCache(
  selectedCategories: string[],
  excludeWord: string
): { text: string; category: string } | null {
  const cache = getCachedWords();
  if (!cache) return null;

  const pool: { text: string; category: string }[] = [];
  for (const cat of selectedCategories) {
    const words = cache.categories[cat];
    if (words) {
      for (const word of words) {
        if (word !== excludeWord) {
          pool.push({ text: word, category: cat });
        }
      }
    }
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Check if the cache has words for the given categories
 */
export function hasCachedCategories(categories: string[]): boolean {
  const cache = getCachedWords();
  if (!cache) return false;
  return categories.some(cat => (cache.categories[cat]?.length ?? 0) > 0);
}

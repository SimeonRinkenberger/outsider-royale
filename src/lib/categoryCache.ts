/**
 * Offline-first Category Cache
 * 
 * Syncs word categories AND category metadata from the database on app load when online,
 * and stores them locally for offline in-person gameplay.
 * 
 * Flow:
 * 1. On app startup, check if online
 * 2. If online, fetch all words + category metadata from DB and cache locally
 * 3. For in-person mode, always use the local cache (works offline)
 * 4. For online mode, still uses RPCs (server handles word selection)
 */

import { supabase } from '@/integrations/supabase/client';
import { BUNDLED_WORDS, BUNDLED_CATEGORIES } from './bundledWords';

const CACHE_KEY = 'outsider-royale-word-cache';
const CACHE_TIMESTAMP_KEY = 'outsider-royale-word-cache-ts';
const CACHE_ENTITLEMENT_KEY = 'outsider-royale-word-cache-entitlement';

export interface CachedWord {
  text: string;
  category: string;
}

export interface CategoryMeta {
  id: string;
  name: string;
  emoji: string;
  isPaid: boolean;
  sortOrder: number;
}

export interface WordCache {
  categories: Record<string, string[]>; // category -> words[]
  categoryMeta: CategoryMeta[]; // category metadata from DB
  lastSynced: string; // ISO timestamp
}

/**
 * Get the cached words from localStorage, falling back to bundled data
 */
export function getCachedWords(): WordCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as WordCache;
      // Ensure categoryMeta exists (backwards compat)
      if (!parsed.categoryMeta) {
        parsed.categoryMeta = BUNDLED_CATEGORIES;
      }
      return parsed;
    }
    // Fall back to bundled words (first launch, no internet)
    return {
      categories: BUNDLED_WORDS,
      categoryMeta: BUNDLED_CATEGORIES,
      lastSynced: 'bundled',
    };
  } catch {
    return {
      categories: BUNDLED_WORDS,
      categoryMeta: BUNDLED_CATEGORIES,
      lastSynced: 'bundled',
    };
  }
}

/**
 * Listeners for cache updates (reactive UI)
 */
let cacheListeners: (() => void)[] = [];

export function onCacheUpdate(listener: () => void): () => void {
  cacheListeners.push(listener);
  return () => {
    cacheListeners = cacheListeners.filter(l => l !== listener);
  };
}

/**
 * Save words to local cache
 */
function saveToCache(cache: WordCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, cache.lastSynced);
  // Notify listeners so UI re-renders with new data
  cacheListeners.forEach(l => l());
}

/**
 * Sync categories from the database.
 * For free users, only fetches the first FREE_WORDS_PER_CATEGORY words per category.
 * For pro users, fetches all words.
 * Returns true if sync was successful.
 */
export async function syncCategories(isPro: boolean = false): Promise<boolean> {
  try {
    // Check if entitlement changed since last sync — if so, force re-sync
    const cachedEntitlementLevel = localStorage.getItem(CACHE_ENTITLEMENT_KEY);
    const currentLevel = isPro ? 'pro' : 'free';
    const entitlementChanged = cachedEntitlementLevel !== currentLevel;

    // Fetch category metadata and words in parallel
    const [metaResult, wordsResult] = await Promise.all([
      supabase.from('categories').select('id, name, emoji, is_paid, sort_order').order('sort_order'),
      fetchAllWords(isPro),
    ]);

    if (metaResult.error) {
      return false;
    }

    if (!wordsResult) return false;

    const categoryMeta: CategoryMeta[] = (metaResult.data || []).map(c => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      isPaid: c.is_paid,
      sortOrder: c.sort_order,
    }));

    const cache: WordCache = {
      categories: wordsResult,
      categoryMeta,
      lastSynced: new Date().toISOString(),
    };

    saveToCache(cache);
    localStorage.setItem(CACHE_ENTITLEMENT_KEY, currentLevel);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch all words from the database (paginated)
 */
async function fetchAllWords(isPro: boolean = false): Promise<Record<string, string[]> | null> {
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
      return null;
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
    return null;
  }

  const categories: Record<string, string[]> = {};
  for (const word of allWords) {
    if (!categories[word.category]) {
      categories[word.category] = [];
    }
    categories[word.category].push(word.text);
  }

  // For free users, truncate each category to FREE_WORDS_PER_CATEGORY
  if (!isPro) {
    for (const cat of Object.keys(categories)) {
      categories[cat] = categories[cat].slice(0, FREE_WORDS_PER_CATEGORY);
    }
  }

  return categories;
}




/**
 * Number of words free users get per category
 */
export const FREE_WORDS_PER_CATEGORY = 15;

/**
 * Get a random word from cached categories (for in-person mode)
 * For free users, only the first FREE_WORDS_PER_CATEGORY words per category are available
 */
export function getRandomWordFromCache(
  selectedCategories: string[],
  isPro: boolean = true
): { text: string; category: string } | null {
  const cache = getCachedWords();
  if (!cache) return null;

  const pool: { text: string; category: string }[] = [];
  for (const cat of selectedCategories) {
    const words = cache.categories[cat];
    if (words) {
      const available = isPro ? words : words.slice(0, FREE_WORDS_PER_CATEGORY);
      for (const word of available) {
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
  excludeWord: string,
  isPro: boolean = true
): { text: string; category: string } | null {
  const cache = getCachedWords();
  if (!cache) return null;

  const pool: { text: string; category: string }[] = [];
  for (const cat of selectedCategories) {
    const words = cache.categories[cat];
    if (words) {
      const available = isPro ? words : words.slice(0, FREE_WORDS_PER_CATEGORY);
      for (const word of available) {
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

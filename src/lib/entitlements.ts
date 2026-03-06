/**
 * Entitlement Helpers
 * 
 * Utility functions for checking access based on entitlement status.
 * Categories are now dynamically loaded from the synced cache (database-driven).
 */

import type { Entitlement } from '@/services/purchases/purchaseService';
import { getCachedWords, type CategoryMeta } from './categoryCache';

/**
 * Get all synced categories from the cache (DB-driven)
 */
export function getSyncedCategories(): CategoryMeta[] {
  const cache = getCachedWords();
  return cache.categoryMeta.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get free category IDs
 */
export function getFreeCategoryIds(): string[] {
  return getSyncedCategories().filter(c => !c.isPaid).map(c => c.id);
}

/**
 * Get paid category IDs
 */
export function getPaidCategoryIds(): string[] {
  return getSyncedCategories().filter(c => c.isPaid).map(c => c.id);
}

/**
 * Check if a category is free (available to all users)
 */
export function isFreeCategory(categoryId: string): boolean {
  const cat = getSyncedCategories().find(c => c.id === categoryId);
  return cat ? !cat.isPaid : false;
}

/**
 * Check if a category is paid (requires Pro)
 */
export function isPaidCategory(categoryId: string): boolean {
  const cat = getSyncedCategories().find(c => c.id === categoryId);
  return cat ? cat.isPaid : false;
}

/**
 * Check if user can access a specific category
 */
export function canAccessCategory(categoryId: string, entitlement: Entitlement): boolean {
  if (entitlement.isPro) return true;
  return isFreeCategory(categoryId);
}

/**
 * Get list of categories user can access
 */
export function getAccessibleCategories(entitlement: Entitlement): string[] {
  const all = getSyncedCategories();
  if (entitlement.isPro) return all.map(c => c.id);
  return all.filter(c => !c.isPaid).map(c => c.id);
}

/**
 * Filter categories to only those user can access
 */
export function filterAccessibleCategories(
  categories: string[],
  entitlement: Entitlement
): string[] {
  if (entitlement.isPro) return categories;
  return categories.filter(cat => isFreeCategory(cat));
}

/**
 * Check if any selected categories are paid-only
 */
export function hasAnyPaidCategories(selectedCategories: string[]): boolean {
  return selectedCategories.some(cat => isPaidCategory(cat));
}

/**
 * Get category display info from synced data
 */
export interface CategoryInfo {
  id: string;
  name: string;
  emoji: string;
  isPaid: boolean;
}

/**
 * Get sorted categories with free first, then paid
 */
export function getSortedCategories(): CategoryInfo[] {
  const cats = getSyncedCategories();
  const free = cats.filter(c => !c.isPaid);
  const paid = cats.filter(c => c.isPaid);
  return [...free, ...paid].map(c => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    isPaid: c.isPaid,
  }));
}

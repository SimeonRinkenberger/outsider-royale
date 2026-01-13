/**
 * Entitlement Helpers
 * 
 * Utility functions for checking access based on entitlement status.
 * Uses cached entitlement - no DB calls during gameplay.
 */

import type { Entitlement } from '@/services/purchases/applePurchases';

// Free categories available to all users
export const FREE_CATEGORIES = ['food', 'animal', 'place', 'thing'] as const;
export type FreeCategory = typeof FREE_CATEGORIES[number];

// Paid categories (require Pro subscription)
export const PAID_CATEGORIES = ['brand', 'movie', 'person', 'degenerate'] as const;
export type PaidCategory = typeof PAID_CATEGORIES[number];

// All categories
export const ALL_CATEGORIES = [...FREE_CATEGORIES, ...PAID_CATEGORIES] as const;
export type Category = typeof ALL_CATEGORIES[number];

/**
 * Check if a category is free (available to all users)
 */
export function isFreeCategory(categoryId: string): boolean {
  return FREE_CATEGORIES.includes(categoryId as FreeCategory);
}

/**
 * Check if a category is paid (requires Pro)
 */
export function isPaidCategory(categoryId: string): boolean {
  return PAID_CATEGORIES.includes(categoryId as PaidCategory);
}

/**
 * Check if user can access a specific category
 * 
 * @param categoryId - The category to check
 * @param entitlement - User's current entitlement state
 * @returns true if user can access this category
 */
export function canAccessCategory(categoryId: string, entitlement: Entitlement): boolean {
  // Pro users can access everything
  if (entitlement.isPro) {
    return true;
  }
  
  // Free users can only access free categories
  return isFreeCategory(categoryId);
}

/**
 * Get list of categories user can access
 * 
 * @param entitlement - User's current entitlement state
 * @returns Array of accessible category IDs
 */
export function getAccessibleCategories(entitlement: Entitlement): readonly string[] {
  if (entitlement.isPro) {
    return ALL_CATEGORIES;
  }
  return FREE_CATEGORIES;
}

/**
 * Filter categories to only those user can access
 * 
 * @param categories - Categories to filter
 * @param entitlement - User's current entitlement state
 * @returns Filtered array of accessible categories
 */
export function filterAccessibleCategories(
  categories: string[],
  entitlement: Entitlement
): string[] {
  if (entitlement.isPro) {
    return categories;
  }
  return categories.filter(cat => isFreeCategory(cat));
}

/**
 * Check if any selected categories are paid-only
 * 
 * @param selectedCategories - User's selected categories
 * @returns true if any selected category requires Pro
 */
export function hasAnyPaidCategories(selectedCategories: string[]): boolean {
  return selectedCategories.some(cat => isPaidCategory(cat));
}

/**
 * Get category display info
 */
export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  isPaid: boolean;
  emoji: string;
}

export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  food: {
    id: 'food',
    name: 'Food & Drinks',
    description: 'Popular foods, drinks, and dishes',
    isPaid: false,
    emoji: '🍕',
  },
  animal: {
    id: 'animal',
    name: 'Animals',
    description: 'Creatures big and small',
    isPaid: false,
    emoji: '🦁',
  },
  place: {
    id: 'place',
    name: 'Places',
    description: 'Cities, countries, and landmarks',
    isPaid: false,
    emoji: '🗺️',
  },
  thing: {
    id: 'thing',
    name: 'Things',
    description: 'Everyday objects and items',
    isPaid: false,
    emoji: '📦',
  },
  brand: {
    id: 'brand',
    name: 'Brands',
    description: 'Famous companies and products',
    isPaid: true,
    emoji: '🏷️',
  },
  movie: {
    id: 'movie',
    name: 'Movies & TV',
    description: 'Films and shows everyone knows',
    isPaid: true,
    emoji: '🎬',
  },
  person: {
    id: 'person',
    name: 'Famous People',
    description: 'Celebrities and historical figures',
    isPaid: true,
    emoji: '⭐',
  },
  degenerate: {
    id: 'degenerate',
    name: 'Spicy',
    description: 'Adult-only risqué content',
    isPaid: true,
    emoji: '🌶️',
  },
};

/**
 * Get sorted categories with free first
 */
export function getSortedCategories(): CategoryInfo[] {
  return [
    ...FREE_CATEGORIES.map(id => CATEGORY_INFO[id]),
    ...PAID_CATEGORIES.map(id => CATEGORY_INFO[id]),
  ];
}

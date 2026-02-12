/**
 * Entitlement Helpers
 * 
 * Utility functions for checking access based on entitlement status.
 * Uses cached entitlement - no DB calls during gameplay.
 */

import type { Entitlement } from '@/services/purchases/applePurchases';

// Free categories available to all users (first 6)
export const FREE_CATEGORIES = ['dog_breeds', 'birds', 'desserts', 'car_brands', 'ocean_animals', 'musical_instruments'] as const;
export type FreeCategory = typeof FREE_CATEGORIES[number];

// Paid categories (require Pro subscription)
export const PAID_CATEGORIES = ['kitchen_appliances', 'superheroes', 'board_games', 'trees', 'scientists', 'video_game_characters'] as const;
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
 */
export function canAccessCategory(categoryId: string, entitlement: Entitlement): boolean {
  if (entitlement.isPro) {
    return true;
  }
  return isFreeCategory(categoryId);
}

/**
 * Get list of categories user can access
 */
export function getAccessibleCategories(entitlement: Entitlement): readonly string[] {
  if (entitlement.isPro) {
    return ALL_CATEGORIES;
  }
  return FREE_CATEGORIES;
}

/**
 * Filter categories to only those user can access
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
  dog_breeds: {
    id: 'dog_breeds',
    name: 'Dog Breeds',
    description: 'Popular and exotic dog breeds',
    isPaid: false,
    emoji: '🐕',
  },
  birds: {
    id: 'birds',
    name: 'Birds',
    description: 'Birds from around the world',
    isPaid: false,
    emoji: '🦅',
  },
  desserts: {
    id: 'desserts',
    name: 'Desserts',
    description: 'Sweet treats and pastries',
    isPaid: false,
    emoji: '🍰',
  },
  car_brands: {
    id: 'car_brands',
    name: 'Car Brands',
    description: 'Automobile manufacturers worldwide',
    isPaid: false,
    emoji: '🚗',
  },
  ocean_animals: {
    id: 'ocean_animals',
    name: 'Ocean Animals',
    description: 'Marine life and sea creatures',
    isPaid: false,
    emoji: '🐙',
  },
  musical_instruments: {
    id: 'musical_instruments',
    name: 'Musical Instruments',
    description: 'Instruments from every culture',
    isPaid: false,
    emoji: '🎸',
  },
  kitchen_appliances: {
    id: 'kitchen_appliances',
    name: 'Kitchen Tools',
    description: 'Cooking gear and gadgets',
    isPaid: true,
    emoji: '🍳',
  },
  superheroes: {
    id: 'superheroes',
    name: 'Superheroes',
    description: 'Heroes and villains from comics',
    isPaid: true,
    emoji: '🦸',
  },
  board_games: {
    id: 'board_games',
    name: 'Board Games',
    description: 'Tabletop and card games',
    isPaid: true,
    emoji: '🎲',
  },
  trees: {
    id: 'trees',
    name: 'Trees',
    description: 'Tree species from every continent',
    isPaid: true,
    emoji: '🌳',
  },
  scientists: {
    id: 'scientists',
    name: 'Famous Scientists',
    description: 'Renowned scientists and inventors',
    isPaid: true,
    emoji: '🔬',
  },
  video_game_characters: {
    id: 'video_game_characters',
    name: 'Video Game Characters',
    description: 'Iconic gaming protagonists and villains',
    isPaid: true,
    emoji: '🎮',
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

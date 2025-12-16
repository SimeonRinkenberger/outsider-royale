import { useState, useEffect, useCallback } from 'react';

export interface CustomCategory {
  id: string;
  name: string;
  words: string[];
  createdAt: string;
}

export interface GameModifier {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface CustomModifier {
  id: string;
  label: string;
  description: string;
  createdAt: string;
}

export interface GamePreset {
  id: string;
  name: string;
  categories: string[]; // Built-in category values
  customCategoryIds: string[]; // Custom category IDs
  modifiers: string[]; // Enabled modifier IDs
  imposterCount: number;
  roundCount: number;
  gameMode: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  customCategories: 'sus-detector-custom-categories',
  presets: 'sus-detector-presets',
  customModifiers: 'sus-detector-custom-modifiers',
};

// Predefined modifiers that hosts can toggle
export const AVAILABLE_MODIFIERS: Omit<GameModifier, 'enabled'>[] = [
  { id: 'one-word', label: 'One-Word Clues', description: 'Clues must be exactly one word' },
  { id: 'no-proper-nouns', label: 'No Proper Nouns', description: 'No names of people, places, or brands' },
  { id: 'rhyming', label: 'Rhyming Clues', description: 'All clues must rhyme with each other' },
  { id: 'emoji-only', label: 'Emoji Only', description: 'Clues can only be emojis' },
  { id: 'silent-round', label: 'Silent Round', description: 'No discussion between rounds' },
  { id: 'speed-round', label: 'Speed Round', description: '15 seconds per clue submission' },
  { id: 'outsider-guess', label: 'Outsider Can Guess', description: 'Outsiders can guess the word at any time to win' },
];

export const useCustomContent = () => {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [presets, setPresets] = useState<GamePreset[]>([]);
  const [customModifiers, setCustomModifiers] = useState<CustomModifier[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedCategories = localStorage.getItem(STORAGE_KEYS.customCategories);
      const storedPresets = localStorage.getItem(STORAGE_KEYS.presets);
      const storedModifiers = localStorage.getItem(STORAGE_KEYS.customModifiers);
      
      if (storedCategories) {
        setCustomCategories(JSON.parse(storedCategories));
      }
      if (storedPresets) {
        setPresets(JSON.parse(storedPresets));
      }
      if (storedModifiers) {
        setCustomModifiers(JSON.parse(storedModifiers));
      }
    } catch (error) {
      console.error('Error loading custom content:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save categories to localStorage
  const saveCategories = useCallback((categories: CustomCategory[]) => {
    setCustomCategories(categories);
    localStorage.setItem(STORAGE_KEYS.customCategories, JSON.stringify(categories));
  }, []);

  // Save presets to localStorage
  const savePresets = useCallback((newPresets: GamePreset[]) => {
    setPresets(newPresets);
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(newPresets));
  }, []);

  // Save custom modifiers to localStorage
  const saveCustomModifiers = useCallback((modifiers: CustomModifier[]) => {
    setCustomModifiers(modifiers);
    localStorage.setItem(STORAGE_KEYS.customModifiers, JSON.stringify(modifiers));
  }, []);

  // Add a custom category
  const addCategory = useCallback((name: string, words: string[]) => {
    const newCategory: CustomCategory = {
      id: `custom-${Date.now()}`,
      name,
      words,
      createdAt: new Date().toISOString(),
    };
    saveCategories([...customCategories, newCategory]);
    return newCategory;
  }, [customCategories, saveCategories]);

  // Update a custom category
  const updateCategory = useCallback((id: string, name: string, words: string[]) => {
    saveCategories(
      customCategories.map(cat => 
        cat.id === id ? { ...cat, name, words } : cat
      )
    );
  }, [customCategories, saveCategories]);

  // Delete a custom category
  const deleteCategory = useCallback((id: string) => {
    saveCategories(customCategories.filter(cat => cat.id !== id));
  }, [customCategories, saveCategories]);

  // Add a custom modifier
  const addModifier = useCallback((label: string, description: string) => {
    const newModifier: CustomModifier = {
      id: `modifier-${Date.now()}`,
      label,
      description,
      createdAt: new Date().toISOString(),
    };
    saveCustomModifiers([...customModifiers, newModifier]);
    return newModifier;
  }, [customModifiers, saveCustomModifiers]);

  // Update a custom modifier
  const updateModifier = useCallback((id: string, label: string, description: string) => {
    saveCustomModifiers(
      customModifiers.map(mod => 
        mod.id === id ? { ...mod, label, description } : mod
      )
    );
  }, [customModifiers, saveCustomModifiers]);

  // Delete a custom modifier
  const deleteModifier = useCallback((id: string) => {
    saveCustomModifiers(customModifiers.filter(mod => mod.id !== id));
  }, [customModifiers, saveCustomModifiers]);

  // Add a preset
  const addPreset = useCallback((preset: Omit<GamePreset, 'id' | 'createdAt'>) => {
    const newPreset: GamePreset = {
      ...preset,
      id: `preset-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    savePresets([...presets, newPreset]);
    return newPreset;
  }, [presets, savePresets]);

  // Delete a preset
  const deletePreset = useCallback((id: string) => {
    savePresets(presets.filter(p => p.id !== id));
  }, [presets, savePresets]);

  // Export preset as shareable code
  const exportPreset = useCallback((preset: GamePreset, includedCustomCategories: CustomCategory[]) => {
    const exportData = {
      preset,
      customCategories: includedCustomCategories,
      version: 1,
    };
    return btoa(JSON.stringify(exportData));
  }, []);

  // Import preset from code
  const importPreset = useCallback((code: string): { preset: GamePreset; customCategories: CustomCategory[] } | null => {
    try {
      const decoded = atob(code);
      const data = JSON.parse(decoded);
      
      if (!data.preset || data.version !== 1) {
        return null;
      }

      // Generate new IDs to avoid conflicts
      const newPreset: GamePreset = {
        ...data.preset,
        id: `preset-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      const newCategories: CustomCategory[] = (data.customCategories || []).map((cat: CustomCategory, index: number) => ({
        ...cat,
        id: `custom-${Date.now()}-${index}`,
        createdAt: new Date().toISOString(),
      }));

      return { preset: newPreset, customCategories: newCategories };
    } catch (error) {
      console.error('Error importing preset:', error);
      return null;
    }
  }, []);

  // Save imported preset and categories
  const saveImported = useCallback((preset: GamePreset, categories: CustomCategory[]) => {
    // Add new categories that don't exist (by name)
    const existingNames = new Set(customCategories.map(c => c.name.toLowerCase()));
    const newCategories = categories.filter(c => !existingNames.has(c.name.toLowerCase()));
    
    if (newCategories.length > 0) {
      saveCategories([...customCategories, ...newCategories]);
    }
    
    // Add the preset
    savePresets([...presets, preset]);
  }, [customCategories, presets, saveCategories, savePresets]);

  return {
    customCategories,
    customModifiers,
    presets,
    isLoaded,
    addCategory,
    updateCategory,
    deleteCategory,
    addModifier,
    updateModifier,
    deleteModifier,
    addPreset,
    deletePreset,
    exportPreset,
    importPreset,
    saveImported,
  };
};

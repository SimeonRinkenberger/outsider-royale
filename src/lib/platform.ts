import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running as a native mobile app (iOS/Android)
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/**
 * Copy text to clipboard with native fallback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (isNative()) {
      // Use Capacitor Clipboard for native
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return true;
    } else {
      // Use Web API for browser
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Image preloader to ensure all app images are cached and ready instantly.
 * Called at app startup to eliminate any image loading flashes.
 */

// Import all fox images
import cryingFox from '@/assets/crying_fox.png';
import foxLoading from '@/assets/fox_loading.gif';
import foxMascot from '@/assets/fox_mascot.png';
import happyFox from '@/assets/happy_fox.png';
import investigativeFox from '@/assets/investigative_fox.png';
import judgeFox from '@/assets/judge_fox.png';
import lobbyFox from '@/assets/lobby_fox.png';
import titleFox from '@/assets/title_fox.png';
import votingFox from '@/assets/voting_fox.png';
import welcomeFox from '@/assets/welcome_fox.png';
import wifiFox from '@/assets/wifi_fox.png';

// Export for use in components
export {
  cryingFox,
  foxLoading,
  foxMascot,
  happyFox,
  investigativeFox,
  judgeFox,
  lobbyFox,
  titleFox,
  votingFox,
  welcomeFox,
  wifiFox,
};

// All images to preload
const ALL_IMAGES = [
  cryingFox,
  foxLoading,
  foxMascot,
  happyFox,
  investigativeFox,
  judgeFox,
  lobbyFox,
  titleFox,
  votingFox,
  welcomeFox,
  wifiFox,
];

// Track preload state
let preloadPromise: Promise<void> | null = null;
let isPreloaded = false;

/**
 * Preload a single image by creating an Image object and waiting for it to load.
 */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload: ${src}`));
    img.src = src;
  });
}

/**
 * Preload all app images. Safe to call multiple times - will only preload once.
 * Returns a promise that resolves when all images are cached.
 */
export function preloadAllImages(): Promise<void> {
  if (isPreloaded) {
    return Promise.resolve();
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = Promise.all(ALL_IMAGES.map(preloadImage))
    .then(() => {
      isPreloaded = true;
      console.log('[ImagePreloader] All images preloaded successfully');
    })
    .catch((error) => {
      console.warn('[ImagePreloader] Some images failed to preload:', error);
      // Still mark as attempted to avoid retrying
      isPreloaded = true;
    });

  return preloadPromise;
}

/**
 * Check if images have been preloaded.
 */
export function areImagesPreloaded(): boolean {
  return isPreloaded;
}

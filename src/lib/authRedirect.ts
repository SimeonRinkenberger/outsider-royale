// Auth redirect utilities using sessionStorage

const RETURN_TO_KEY = 'auth:returnTo';
const RETURN_TO_TIMESTAMP_KEY = 'auth:returnToAt';

/**
 * Set the returnTo route for after auth success.
 * Only sets if current route is not /auth and not already set.
 */
export const setAuthReturnTo = (currentPath: string, force = false): void => {
  // Don't store /auth as a return destination
  if (currentPath === '/auth' || currentPath.startsWith('/auth')) {
    console.log('[AUTH] not setting returnTo - already on auth page');
    return;
  }

  // Don't overwrite existing returnTo unless forced
  const existing = sessionStorage.getItem(RETURN_TO_KEY);
  if (existing && !force) {
    console.log('[AUTH] returnTo already set:', existing, '- not overwriting');
    return;
  }

  console.log('[AUTH] setting returnTo=', currentPath);
  sessionStorage.setItem(RETURN_TO_KEY, currentPath);
  sessionStorage.setItem(RETURN_TO_TIMESTAMP_KEY, Date.now().toString());
};

/**
 * Get and clear the returnTo route.
 * Returns the stored route or null if none exists.
 */
export const getAndClearAuthReturnTo = (): string | null => {
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  
  // Clear immediately to prevent reuse
  sessionStorage.removeItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_TIMESTAMP_KEY);

  if (returnTo && returnTo !== '/auth') {
    console.log('[AUTH] success, redirecting to returnTo=', returnTo);
    return returnTo;
  }

  console.log('[AUTH] no returnTo found, redirecting to menu');
  return null;
};

/**
 * Get the returnTo route without clearing it (for back button).
 */
export const peekAuthReturnTo = (): string | null => {
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  return returnTo && returnTo !== '/auth' ? returnTo : null;
};

/**
 * Clear the returnTo without using it.
 */
export const clearAuthReturnTo = (): void => {
  sessionStorage.removeItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_TIMESTAMP_KEY);
};

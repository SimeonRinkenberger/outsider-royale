// Session modes for the app
export type SessionMode = 'guest' | 'authed' | 'none';

export const generateLobbyCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getStoredUserId = (): string | null => {
  return localStorage.getItem('userId');
};

export const setStoredUserId = (userId: string): void => {
  localStorage.setItem('userId', userId);
};

export const getStoredDisplayName = (): string | null => {
  return localStorage.getItem('displayName');
};

export const setStoredDisplayName = (name: string): void => {
  localStorage.setItem('displayName', name);
};

export const getStoredAvatarId = (): string | null => {
  return localStorage.getItem('avatarId');
};

export const setStoredAvatarId = (avatarId: string): void => {
  localStorage.setItem('avatarId', avatarId);
};

export const getStoredIsGuest = (): boolean => {
  return localStorage.getItem('isGuest') === 'true';
};

export const setStoredIsGuest = (isGuest: boolean): void => {
  localStorage.setItem('isGuest', isGuest ? 'true' : 'false');
};

export const clearStorage = (): void => {
  localStorage.removeItem('userId');
  localStorage.removeItem('displayName');
  localStorage.removeItem('avatarId');
  localStorage.removeItem('isGuest');
};

/**
 * Get the current session mode:
 * - 'authed': User has a userId and is NOT a guest (signed in with email)
 * - 'guest': User has a userId and IS a guest
 * - 'none': No userId at all
 */
export const getSessionMode = (): SessionMode => {
  const userId = getStoredUserId();
  if (!userId) {
    return 'none';
  }
  
  const isGuest = getStoredIsGuest();
  return isGuest ? 'guest' : 'authed';
};

/**
 * Check if user has any valid session (guest or authed)
 */
export const hasValidSession = (): boolean => {
  return getSessionMode() !== 'none';
};

/**
 * Check if user is authenticated (not a guest)
 */
export const isAuthenticated = (): boolean => {
  return getSessionMode() === 'authed';
};

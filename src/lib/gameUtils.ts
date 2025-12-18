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

export const clearStorage = (): void => {
  localStorage.removeItem('userId');
  localStorage.removeItem('displayName');
  localStorage.removeItem('avatarId');
};

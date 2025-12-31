import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  isReconnecting: boolean;
  lastOnlineAt: Date | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isReconnecting: false,
  lastOnlineAt: null,
});

export const useNetwork = () => useContext(NetworkContext);

interface NetworkProviderProps {
  children: React.ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );

  const handleOnline = useCallback(() => {
    setIsReconnecting(false);
    setIsOnline(true);
    setLastOnlineAt(new Date());
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setIsReconnecting(true);
    
    // After a short delay, stop showing "reconnecting" if still offline
    setTimeout(() => {
      if (!navigator.onLine) {
        setIsReconnecting(false);
      }
    }, 5000);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return (
    <NetworkContext.Provider value={{ isOnline, isReconnecting, lastOnlineAt }}>
      {children}
    </NetworkContext.Provider>
  );
};

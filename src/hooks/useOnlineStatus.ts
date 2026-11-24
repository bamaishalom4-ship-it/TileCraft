import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Tracks browser online/offline state reactively on Web (defaults to true on native).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return navigator.onLine !== false;
    }
    return true;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

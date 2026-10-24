import { useEffect } from 'react';

/** Browsers drop the lock whenever the page is hidden, so it is requested again on each return. */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          if (active) lock = sentinel;
          else void sentinel.release();
        },
        () => {},
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, []);
}

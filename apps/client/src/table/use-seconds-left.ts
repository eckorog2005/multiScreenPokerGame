import { useEffect, useState } from 'react';

/** Counts down from `ms` as it was on mount; remount (e.g. with a `key`) to restart from a newer value. */
export function useSecondsLeft(ms: number): number {
  const [deadline] = useState(() => Date.now() + ms);
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return Math.ceil(left / 1000);
}

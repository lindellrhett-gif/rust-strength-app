import { useEffect, useRef, useState } from 'react';

/**
 * The value, passed on at most once every `ms` milliseconds. The latest value
 * always arrives in the end; changes in between are skipped. With `ms` of 0
 * every change passes straight through.
 */
export function useThrottled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const lastShownAt = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, lastShownAt.current + ms - Date.now());
    const id = setTimeout(() => {
      lastShownAt.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(id);
  }, [value, ms]);
  return shown;
}

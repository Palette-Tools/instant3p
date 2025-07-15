import { useEffect, useRef } from 'react';

export function useTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    clear();
  }, []);

  function set(delay: number, fn: () => void) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(fn, delay);
  }

  function clear() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = null;
  }

  return { set, clear };
}

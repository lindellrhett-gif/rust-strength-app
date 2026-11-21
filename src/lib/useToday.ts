import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayLocal } from '@/lib/dates';

/**
 * Today's date (YYYY-MM-DD, on the phone's clock) that moves on by itself: at
 * midnight while the screen is open, and when the app comes back from the
 * background on a later day.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal);

  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const midnight = new Date();
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(refresh, midnight.getTime() - Date.now());
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today]);

  return today;
}

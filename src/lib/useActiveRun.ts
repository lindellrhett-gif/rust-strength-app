import { useEffect, useSyncExternalStore } from 'react';

import type { ActiveRun } from '@/domain/running/activeRunStore';

import { runStore } from './runStore';

const subscribe = (onChange: () => void) => runStore.subscribe(onChange);
const snapshot = () => runStore.current();

/**
 * The run being recorded, if any, kept in sync with the on-disk store. Fixes
 * written by the GPS task show up here as they arrive.
 */
export function useActiveRun(): ActiveRun | null {
  const run = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void runStore.load();
  }, []);
  return run;
}

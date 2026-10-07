import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { ActiveRun } from '@/domain/running/activeRunStore';

import { runStore } from './runStore';

const noop = () => undefined;

/**
 * The run being recorded, if any, kept in sync with the on-disk store. Fixes
 * written by the GPS task show up here as they arrive.
 *
 * With `paused`, it stops following the store and keeps returning the run as
 * it last was: a screen nobody can see (the phone is locked) then doesn't
 * redo its work on every fix, and catches up as soon as it is unpaused.
 */
export function useActiveRun({ paused = false }: { paused?: boolean } = {}): ActiveRun | null {
  const held = useRef<ActiveRun | null>(runStore.current());
  const subscribeToStore = useCallback(
    (onChange: () => void) => (paused ? noop : runStore.subscribe(onChange)),
    [paused],
  );
  const read = useCallback(() => {
    if (!paused) held.current = runStore.current();
    return held.current;
  }, [paused]);
  const run = useSyncExternalStore(subscribeToStore, read, read);
  useEffect(() => {
    void runStore.load();
  }, []);
  return run;
}

const subscribe = (onChange: () => void) => runStore.subscribe(onChange);
const inProgress = () => {
  const status = runStore.current()?.meta.recorder.status;
  return status != null && status !== 'idle';
};

/**
 * Whether a run is under way or waiting to be saved. Changes only when that
 * answer does, not on every GPS fix, so screens behind the recorder stay idle.
 */
export function useRunInProgress(): boolean {
  const value = useSyncExternalStore(subscribe, inProgress, inProgress);
  useEffect(() => {
    void runStore.load();
  }, []);
  return value;
}

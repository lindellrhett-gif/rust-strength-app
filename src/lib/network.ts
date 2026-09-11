import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Tells React Query whether the phone has a network.
 *
 * Without this it assumes it is always online, tries every request, and fails
 * them — which in a basement gym means a set you logged simply does not save.
 * With it, writes are held and replayed when signal comes back.
 */
let started = false;

export function startNetworkWatcher(): void {
  if (started) return;
  started = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while the check is still in flight, and
      // treating "not yet known" as offline would flash the banner every time
      // the app wakes. Only an explicit false counts as no internet.
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    }),
  );
}

/** Re-renders when the connection comes or goes. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    // Assume online until proven otherwise, so nothing flashes on first paint.
    () => true,
  );
}

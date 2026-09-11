import { useMutationState } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '@/lib/network';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/**
 * A strip across the top when the phone has no network.
 *
 * Worth the screen space because the app deliberately behaves as if a set saved
 * when it has only been queued. Without this, "it saved" and "it saved to your
 * phone and will sync later" look identical, and the first person to lose a
 * session to a flat battery would be right to be annoyed.
 */
export function OfflineBanner() {
  const online = useIsOnline();

  // Writes waiting for a connection. A paused mutation is one the queue is
  // holding rather than one that failed.
  const queued = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;

  const insets = useSafeAreaInsets();

  if (online && queued === 0) return null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }, !online && styles.offline]}>
      <Text style={styles.text}>
        {!online
          ? queued > 0
            ? `Offline — ${queued} ${queued === 1 ? 'change' : 'changes'} saved on this phone`
            : 'Offline — anything you log is saved on this phone'
          : `Syncing ${queued} ${queued === 1 ? 'change' : 'changes'}…`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
  },
  offline: { backgroundColor: colors.warning },
  text: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
});

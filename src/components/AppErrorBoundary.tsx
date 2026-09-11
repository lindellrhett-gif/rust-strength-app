import type { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { LEGAL } from '@/legal/config';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * What someone sees instead of a blank screen when a render throws.
 *
 * Exported as `ErrorBoundary` from the root layout, which is how Expo Router
 * installs one. Without it a single bad render takes the whole app down with no
 * way back and nothing to report.
 *
 * Three jobs, in order of what a person in a gym actually needs: tell them
 * their logged sets are not lost, give them a way out that is not force-quit,
 * and show enough detail to put in an email.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={text.hero}>Something broke</Text>

        <Text style={text.bodyMuted}>
          This screen hit an error and stopped. Everything you have already saved is on the
          server, not on this phone, so nothing you logged has been lost.
        </Text>

        <View style={styles.detail}>
          <Text style={text.label}>WHAT WENT WRONG</Text>
          <Text style={styles.message} selectable>
            {describe(error)}
          </Text>
        </View>

        <Text style={text.caption}>
          If this keeps happening, email {LEGAL.contactEmail} with the text above and what you
          were doing at the time.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Try again" size="lg" onPress={retry} />
      </View>
    </View>
  );
}

/**
 * A message worth pasting into an email. The stack is deliberately left out —
 * it is unreadable on a phone and pushes the useful line off screen.
 */
function describe(error: Error): string {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message) return message;
  // Some thrown values are not really Errors.
  return String(error ?? 'Unknown error');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  detail: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  message: { color: colors.danger, fontSize: 14 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { useProStatus, useRestorePurchases } from '@/data/subscription';
import { statusLine } from '@/domain/subscription';
import { formatDate } from '@/lib/dates';
import { manageSubscription } from '@/lib/purchases';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * Rust Strength Pro on the Profile tab: the status, a way in to the plans or
 * to Apple's subscription settings, and Restore. Only shown while
 * subscriptions are on.
 */
export function ProCard() {
  const router = useRouter();
  const status = useProStatus();
  const restore = useRestorePurchases();
  const active = status.data?.active === true;

  const fail = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  return (
    <Card title="Rust Strength Pro">
      <Text style={text.body}>{status.data ? statusLine(status.data, formatDate) : 'Checking…'}</Text>
      {active ? (
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={() => void manageSubscription().catch(fail('Couldn’t open subscriptions'))}
        />
      ) : (
        <Button label="See plans" variant="secondary" onPress={() => router.push('/paywall')} />
      )}
      <View style={styles.row}>
        <Pressable
          onPress={() =>
            restore.mutate(undefined, {
              onSuccess: (s) =>
                Alert.alert(s.active ? 'Purchases restored' : 'Nothing to restore', undefined),
              onError: fail('Couldn’t restore purchases'),
            })
          }
          disabled={restore.isPending}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.link}>{restore.isPending ? 'Restoring…' : 'Restore purchases'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingTop: spacing.xs },
  link: { color: colors.primary, fontWeight: '600' },
});

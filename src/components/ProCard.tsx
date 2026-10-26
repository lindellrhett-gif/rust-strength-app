import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { useCustomerCenter, useProStatus, useRestorePurchases, useShowPaywall } from '@/data/subscription';
import { statusLine } from '@/domain/subscription';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * Rust Strength Pro on the Profile tab: the status, RevenueCat's paywall for
 * anyone without Pro, its Customer Center for subscribers, and Restore. Only
 * shown while subscriptions are on.
 */
export function ProCard() {
  const status = useProStatus();
  const paywall = useShowPaywall();
  const customerCenter = useCustomerCenter();
  const restore = useRestorePurchases();
  const pro = status.data;

  const fail = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  return (
    <Card title="Rust Strength Pro">
      <Text style={text.body}>{pro ? statusLine(pro, formatDate) : 'Checking…'}</Text>
      {pro?.active ? (
        <Button
          label={pro.lifetime ? 'Purchase help' : 'Manage subscription'}
          variant="secondary"
          onPress={() => customerCenter.mutate(undefined, { onError: fail('Couldn’t open subscriptions') })}
          loading={customerCenter.isPending}
        />
      ) : (
        <Button
          label="See plans"
          variant="secondary"
          onPress={() =>
            paywall.mutate(undefined, {
              onSuccess: (outcome) => {
                if (outcome === 'purchased') Alert.alert('Welcome to Pro', 'Thanks for supporting Rust Strength.');
                if (outcome === 'restored') Alert.alert('Purchases restored', 'Rust Strength Pro is active.');
                if (outcome === 'error') Alert.alert('Couldn’t show the plans', 'Check your connection and try again.');
              },
              onError: fail('Couldn’t show the plans'),
            })
          }
          loading={paywall.isPending}
        />
      )}
      <View style={styles.row}>
        <Pressable
          onPress={() =>
            restore.mutate(undefined, {
              onSuccess: (s) =>
                Alert.alert(
                  s.active ? 'Purchases restored' : 'Nothing to restore',
                  s.active ? undefined : 'No Rust Strength Pro purchase was found for this Apple ID.',
                ),
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

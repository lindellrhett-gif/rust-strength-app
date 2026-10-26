import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, LoadingView } from '@/components';
import { BrandMark } from '@/components/share/cardParts';
import { useBuyPlan, usePlans, useProStatus, useRestorePurchases } from '@/data/subscription';
import {
  PRO_FEATURE_LIST,
  introLabel,
  priceLine,
  renewalTerms,
  statusLine,
  yearlySavings,
  type Plan,
} from '@/domain/subscription';
import { formatDate } from '@/lib/dates';
import { manageSubscription, subscriptionsOn } from '@/lib/purchases';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * Rust Strength Pro. Shows only features that exist in this build, the
 * store's own prices, Apple's renewal terms, Restore, and links to the Terms
 * and Privacy Policy, as App Review requires of a subscription screen.
 */
export default function Paywall() {
  const router = useRouter();
  const plans = usePlans();
  const status = useProStatus();
  const buyPlan = useBuyPlan();
  const restorePurchases = useRestorePurchases();
  const [picked, setPicked] = useState<string | null>(null);

  if (!subscriptionsOn) {
    return <EmptyState title="Not available yet" message="Rust Strength Pro isn’t on sale yet." />;
  }
  if (plans.isLoading || status.isLoading) return <LoadingView />;

  const list = plans.data ?? [];
  const monthly = list.find((p) => p.period === 'month');
  const yearly = list.find((p) => p.period === 'year');
  const selected = list.find((p) => p.id === picked) ?? yearly ?? monthly ?? null;
  const savings = monthly && yearly ? yearlySavings(monthly.price, yearly.price) : null;
  const features = PRO_FEATURE_LIST.filter((f) => f.available);
  const busy = buyPlan.isPending || restorePurchases.isPending;

  const fail = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  const subscribe = () => {
    if (!selected) return;
    buyPlan.mutate(selected.id, {
      onSuccess: (result) => {
        if (result?.active) {
          Alert.alert('Welcome to Pro', 'Thanks for supporting Rust Strength.');
          router.back();
        }
      },
      onError: fail('The purchase didn’t go through'),
    });
  };

  const restore = () =>
    restorePurchases.mutate(undefined, {
      onSuccess: (result) =>
        Alert.alert(
          result.active ? 'Purchases restored' : 'Nothing to restore',
          result.active
            ? 'Rust Strength Pro is active on this account.'
            : 'No Rust Strength Pro subscription was found for this Apple ID.',
        ),
      onError: fail('Couldn’t restore purchases'),
    });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BrandMark size={64} />
          <Text style={text.hero}>Rust Strength Pro</Text>
          <Text style={[text.bodyMuted, styles.center]}>
            Everything you use now stays free. Pro adds:
          </Text>
        </View>

        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.feature} style={styles.feature}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={text.heading}>{f.title}</Text>
                <Text style={text.bodyMuted}>{f.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {status.data?.active ? (
          <View style={styles.subscribed}>
            <Text style={text.heading}>You have Pro</Text>
            <Text style={text.bodyMuted}>{statusLine(status.data, formatDate)}</Text>
            <Button
              label="Manage subscription"
              variant="secondary"
              onPress={() => void manageSubscription().catch(fail('Couldn’t open subscriptions'))}
            />
          </View>
        ) : list.length === 0 ? (
          <Text style={[text.bodyMuted, styles.center]}>
            {plans.isError
              ? 'Couldn’t load the plans. Check your connection and try again.'
              : 'No plans are available right now. Try again later.'}
          </Text>
        ) : (
          <>
            <View style={styles.plans} accessibilityRole="radiogroup">
              {[yearly, monthly]
                .filter((p): p is Plan => p != null)
                .map((p) => (
                  <PlanOption
                    key={p.id}
                    plan={p}
                    selected={selected?.id === p.id}
                    badge={p.period === 'year' && savings ? `Save ${savings}%` : null}
                    onPress={() => setPicked(p.id)}
                  />
                ))}
            </View>
            {selected ? (
              <>
                <Button
                  label={selected.intro?.price === 0 ? 'Start free trial' : 'Subscribe'}
                  size="lg"
                  onPress={subscribe}
                  loading={buyPlan.isPending}
                  disabled={busy}
                />
                <Text style={[text.caption, styles.center]}>{renewalTerms(selected)}</Text>
              </>
            ) : null}
          </>
        )}

        <View style={styles.links}>
          <Pressable onPress={restore} disabled={busy} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{restorePurchases.isPending ? 'Restoring…' : 'Restore purchases'}</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanOption({
  plan,
  selected,
  badge,
  onPress,
}: {
  plan: Plan;
  selected: boolean;
  badge: string | null;
  onPress: () => void;
}) {
  const intro = introLabel(plan.intro);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.period === 'year' ? 'Yearly' : 'Monthly'}, ${priceLine(plan)}${intro ? `, ${intro}` : ''}${badge ? `, ${badge}` : ''}`}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.primary : colors.textFaint}
      />
      <View style={styles.flex}>
        <Text style={text.heading}>{plan.period === 'year' ? 'Yearly' : 'Monthly'}</Text>
        <Text style={text.bodyMuted}>{priceLine(plan)}</Text>
        {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  center: { textAlign: 'center' },
  features: { gap: spacing.md },
  feature: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  plans: { gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planSelected: { borderColor: colors.primary },
  intro: { color: colors.success, fontSize: 13, fontWeight: '700' },
  badge: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
  subscribed: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  link: { color: colors.primary, fontWeight: '600' },
  dot: { color: colors.textFaint },
});

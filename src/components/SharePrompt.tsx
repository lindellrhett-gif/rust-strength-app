import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { useFriendships } from '@/data/friends';
import { useProfile, useUpdateProfile } from '@/data/profile';
import { shareChoice, shouldAskToShare } from '@/domain/sharePrompt';
import { spacing, text } from '@/theme/typography';

/**
 * The one-time question, once someone has their first accepted friend:
 * share your sessions in the feed, or not. Sharing starts off for new
 * accounts (migration 0031); see src/domain/sharePrompt.ts for when it shows.
 *
 * Both answers are equally easy and look the same, so neither is nudged
 * (the UK Children's Code, standard 13), and either one makes it go away for
 * good. "Keep private", not "Not now": it never asks again.
 */
export function SharePrompt() {
  const profile = useProfile();
  const friendships = useFriendships();
  const update = useUpdateProfile();

  const accepted = (friendships.data ?? []).filter((e) => e.status === 'accepted').length;
  if (!shouldAskToShare(profile.data, accepted)) return null;

  const answer = (on: boolean) =>
    update.mutate(shareChoice(on, profile.data), {
      onError: (e) =>
        Alert.alert('Could not save', e instanceof Error && e.message ? e.message : 'Please try again.'),
    });

  return (
    <Card title="Share your sessions with friends?" style={styles.card}>
      <Text style={text.bodyMuted}>
        Friends you have accepted would see a summary of each workout and activity in their feed: its
        name, time, volume and which exercises you did. Never individual sets, and never your food
        diary. You can change this any time in Profile, under Sharing with friends.
      </Text>
      <View style={styles.row}>
        <Button
          label="Keep private"
          variant="secondary"
          onPress={() => answer(false)}
          disabled={update.isPending}
          style={styles.flex}
        />
        <Button
          label="Share"
          variant="secondary"
          onPress={() => answer(true)}
          disabled={update.isPending}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/Field';
import { HelpButton } from '@/components/HelpButton';
import { keyboardAware } from '@/components/keyboard';
import {
  useFriendships,
  useRemoveFriend,
  useRespondToRequest,
  useSearchUsers,
  useSendFriendRequest,
} from '@/data/friends';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * Searching for people, answering requests and your list of friends, opened
 * from the icon on the Friends tab.
 */
export default function FindFriends() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const friendships = useFriendships();
  const search = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();
  const respond = useRespondToRequest();
  const removeFriend = useRemoveFriend();

  const edges = friendships.data ?? [];
  const accepted = edges.filter((e) => e.status === 'accepted');
  const incoming = edges.filter((e) => e.status === 'pending' && !e.outgoing);
  const outgoing = edges.filter((e) => e.status === 'pending' && e.outgoing);

  const knownIds = new Set(edges.map((e) => e.otherUserId));

  const saved = (title: string) => ({
    onError: (e: unknown) =>
      Alert.alert(title, e instanceof Error && e.message ? e.message : 'Please try again.'),
  });
  const answer = (id: string, accept: boolean) =>
    respond.mutate({ id, accept }, saved(accept ? 'Could not accept' : 'Could not decline'));
  const askRemove = (id: string, username: string) =>
    Alert.alert('Remove friend?', `@${username}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFriend.mutate(id, saved('Could not remove')),
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
        <Field
          label="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="at least 3 characters"
        />

        {query.trim().length >= 3 ? (
          <Card>
            {search.isLoading ? (
              <Text style={text.bodyMuted}>Searching…</Text>
            ) : search.isError || search.fetchStatus === 'paused' ? (
              <Text style={text.bodyMuted}>Could not search. Check your connection and try again.</Text>
            ) : (search.data ?? []).length === 0 ? (
              <Text style={text.bodyMuted}>No users found.</Text>
            ) : (
              (search.data ?? []).map((u) => (
                <View key={u.user_id} style={styles.row}>
                  <Avatar name={u.display_name || u.username} size={36} />
                  <View style={styles.rowMain}>
                    <Text style={text.body}>@{u.username}</Text>
                    {u.display_name ? <Text style={text.caption}>{u.display_name}</Text> : null}
                  </View>
                  {knownIds.has(u.user_id) ? (
                    <Text style={text.caption}>already connected</Text>
                  ) : (
                    <Button
                      label="Add"
                      onPress={() =>
                        sendRequest.mutate(u.user_id, {
                          onError: (e) =>
                            Alert.alert(
                              'Could not send request',
                              e instanceof Error ? e.message : 'Try again.',
                            ),
                        })
                      }
                    />
                  )}
                </View>
              ))
            )}
          </Card>
        ) : null}

        {incoming.length > 0 ? (
          <Card title={`Requests · ${incoming.length}`}>
            {incoming.map((e) => (
              <View key={e.id} style={styles.request}>
                <View style={styles.requestWho}>
                  <Avatar name={e.displayName || e.username} size={36} />
                  <View style={styles.rowMain}>
                    <Text style={text.body} numberOfLines={1}>
                      @{e.username}
                    </Text>
                    {e.displayName ? <Text style={text.caption}>{e.displayName}</Text> : null}
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Decline"
                    variant="ghost"
                    onPress={() => answer(e.id, false)}
                    accessibilityLabel={`Decline @${e.username}`}
                  />
                  <Button
                    label="Accept"
                    onPress={() => answer(e.id, true)}
                    accessibilityLabel={`Accept @${e.username}`}
                  />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <View style={styles.cardHead}>
            <Text style={text.label}>{`FRIENDS · ${accepted.length}`}</Text>
            <HelpButton
              title="Your friends"
              body="Tap someone to open their profile. Press and hold to remove them."
            />
          </View>
          {accepted.length === 0 ? (
            <Text style={text.bodyMuted}>No friends yet. Search for a username above.</Text>
          ) : (
            accepted.map((e) => (
              <Pressable
                key={e.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(`/friend/${e.otherUserId}`)}
                onLongPress={() => askRemove(e.id, e.username)}
                accessibilityRole="button"
                accessibilityLabel={`@${e.username}. Open their profile.`}
                accessibilityActions={[{ name: 'remove', label: 'Remove friend' }]}
                onAccessibilityAction={() => askRemove(e.id, e.username)}
              >
                <Avatar name={e.displayName || e.username} size={36} />
                <View style={styles.rowMain}>
                  <Text style={text.body} numberOfLines={1}>
                    @{e.username}
                  </Text>
                  {e.displayName ? <Text style={text.caption}>{e.displayName}</Text> : null}
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))
          )}
        </Card>

        {outgoing.length > 0 ? (
          <Card title="Sent requests">
            {outgoing.map((e) => (
              <View key={e.id} style={styles.row}>
                <Avatar name={e.displayName || e.username} size={36} />
                <View style={styles.rowMain}>
                  <Text style={text.body} numberOfLines={1}>
                    @{e.username}
                  </Text>
                  <Text style={text.caption}>waiting for them to accept</Text>
                </View>
                <Pressable
                  onPress={() => removeFriend.mutate(e.id, saved('Could not cancel'))}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel request to @${e.username}`}
                >
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowMain: { gap: 2, flexShrink: 1, flex: 1 },
  // Stacked, so the name fits: you're deciding on the person.
  request: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestWho: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
  cancel: { color: colors.danger, fontWeight: '700' },
});

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { Field } from '@/components/Field';
import {
  useFriendships,
  useRemoveFriend,
  useRespondToRequest,
  useSearchUsers,
  useSendFriendRequest,
} from '@/data/friends';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function FriendsScreen() {
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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card title="Find lifters">
          <Field
            label="Search by username"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="at least 2 characters"
          />
          {query.trim().length >= 2 ? (
            search.isLoading ? (
              <Text style={text.bodyMuted}>Searching…</Text>
            ) : (search.data ?? []).length === 0 ? (
              <Text style={text.bodyMuted}>No users found.</Text>
            ) : (
              (search.data ?? []).map((u) => (
                <View key={u.user_id} style={styles.row}>
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
            )
          ) : null}
        </Card>

        {incoming.length > 0 ? (
          <Card title={`Requests · ${incoming.length}`}>
            {incoming.map((e) => (
              <View key={e.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={text.body}>@{e.username}</Text>
                  <Text style={text.caption}>wants to be friends</Text>
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Decline"
                    variant="ghost"
                    onPress={() => respond.mutate({ id: e.id, accept: false })}
                  />
                  <Button
                    label="Accept"
                    onPress={() => respond.mutate({ id: e.id, accept: true })}
                  />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card title={`Friends · ${accepted.length}`}>
          {accepted.length === 0 ? (
            <Text style={text.bodyMuted}>
              No friends yet. Search for a username above to send a request.
            </Text>
          ) : (
            accepted.map((e) => (
              <Pressable
                key={e.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(`/friend/${e.otherUserId}`)}
                onLongPress={() =>
                  Alert.alert('Remove friend?', `@${e.username}`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => removeFriend.mutate(e.id),
                    },
                  ])
                }
              >
                <View style={styles.rowMain}>
                  <Text style={text.body}>@{e.username}</Text>
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
                <View style={styles.rowMain}>
                  <Text style={text.body}>@{e.username}</Text>
                  <Text style={text.caption}>waiting for them to accept</Text>
                </View>
                <Pressable onPress={() => removeFriend.mutate(e.id)} hitSlop={8}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowMain: { gap: 2, flexShrink: 1, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
  cancel: { color: colors.danger, fontWeight: '700' },
});

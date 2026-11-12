import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import type { RowEntry, Ring } from '@/domain/friendsRow';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

const SIZE = 52;

export function ringColor(ring: Ring): string | null {
  if (ring === 'record') return colors.warning;
  if (ring === 'trained') return colors.primary;
  return null;
}

function ringWords(ring: Ring): string {
  if (ring === 'record') return ', set a record today';
  if (ring === 'trained') return ', trained today';
  return '';
}

/**
 * You and your friends across the top of the Friends tab. A blue ring means they
 * trained today and a gold one that they set a record, from the posts the feed
 * has already loaded.
 */
export function FriendsRow({
  myName,
  myRing,
  entries,
  onOpenMe,
  onOpenFriend,
  onFindFriends,
}: {
  myName: string;
  myRing: Ring;
  entries: RowEntry[];
  onOpenMe: () => void;
  onOpenFriend: (userId: string) => void;
  onFindFriends: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      <Pressable
        onPress={onOpenMe}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={`You${ringWords(myRing)}. Open your profile.`}
      >
        <Avatar name={myName} size={SIZE} ringColor={ringColor(myRing)} />
        <Text style={styles.name} numberOfLines={1}>
          You
        </Text>
      </Pressable>

      {entries.map(({ friend, ring }) => (
        <Pressable
          key={friend.otherUserId}
          onPress={() => onOpenFriend(friend.otherUserId)}
          style={styles.person}
          accessibilityRole="button"
          accessibilityLabel={`${friend.username}${ringWords(ring)}. Open their profile.`}
        >
          <Avatar
            name={friend.displayName || friend.username}
            size={SIZE}
            ringColor={ringColor(ring)}
          />
          <Text style={styles.name} numberOfLines={1}>
            {friend.username}
          </Text>
        </Pressable>
      ))}

      {entries.length === 0 ? (
        <Pressable
          onPress={onFindFriends}
          style={styles.person}
          accessibilityRole="button"
          accessibilityLabel="Find friends"
        >
          <View style={styles.add}>
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            Add
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  person: { width: 62, alignItems: 'center', gap: spacing.xs },
  name: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  add: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

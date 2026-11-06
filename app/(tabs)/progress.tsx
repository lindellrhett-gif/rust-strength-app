import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { keyboardAware } from '@/components/keyboard';
import { CalendarSection } from '@/components/progress/CalendarSection';
import { StatsSection } from '@/components/progress/StatsSection';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

/**
 * Progress: the calendar and the chosen day, the way into every recent
 * workout, then the stats. Calendar and Stats were separate tabs before 1.2.
 */
export default function Progress() {
  const router = useRouter();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh fetches what's on this screen again, and nothing else.
  const refresh = async () => {
    setRefreshing(true);
    await client.refetchQueries({ type: 'active' }).catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        {...keyboardAware}
        refreshControl={
          <RefreshControl tintColor={colors.textMuted} refreshing={refreshing} onRefresh={() => void refresh()} />
        }
      >
        <CalendarSection />

        <Pressable
          style={({ pressed }) => [styles.recent, pressed && styles.recentPressed]}
          onPress={() => router.push('/recent')}
          accessibilityRole="button"
        >
          <Text style={styles.recentText}>Recent workouts</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <StatsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  recentPressed: { backgroundColor: colors.border },
  recentText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chev: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
});

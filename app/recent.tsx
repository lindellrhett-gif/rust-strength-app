import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components';
import { TimelineRow } from '@/components/progress/TimelineRow';
import { useTimeline } from '@/data/timeline';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * Every recent workout, run, activity and rest day, newest first, opened from
 * the Progress tab. Tap a workout or run to open it.
 */
export default function RecentWorkouts() {
  const { timeline, isLoading, isRefetching, refetch } = useTimeline();

  if (isLoading && timeline.length === 0) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={timeline}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <TimelineRow entry={item} />}
        contentContainerStyle={styles.content}
        style={styles.list}
        ListHeaderComponent={<View style={styles.top} />}
        ListEmptyComponent={
          <Text style={[text.bodyMuted, styles.empty]}>Workouts, activities and rest days show up here.</Text>
        }
        refreshControl={<RefreshControl tintColor={colors.textMuted} refreshing={isRefetching} onRefresh={refetch} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { margin: spacing.lg },
  content: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // The first row's top border sits against the card's edge otherwise.
  top: { height: 0, marginBottom: -1 },
  empty: { paddingVertical: spacing.lg },
});

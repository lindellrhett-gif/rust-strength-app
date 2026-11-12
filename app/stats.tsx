import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatsSection } from '@/components/progress/StatsSection';
import { settledOrAfter } from '@/lib/pullRefresh';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/** Every number, opened from Progress: totals, running, food, activity, records. */
export default function AllStats() {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await settledOrAfter(client.refetchQueries({ type: 'active' }));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl tintColor={colors.textMuted} refreshing={refreshing} onRefresh={() => void refresh()} />
        }
      >
        <StatsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
});

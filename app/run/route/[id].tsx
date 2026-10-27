import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingView, Screen, StatTile } from '@/components';
import { RunMap } from '@/components/RunMap';
import { useProfile } from '@/data/profile';
import { useDeleteRoute, useRenameRoute, useSavedRoute, type SavedRoute } from '@/data/routes';
import { formatClock } from '@/domain/duration';
import { rankAttempts } from '@/domain/running/routes';
import { formatDistance, formatPace, paceSeconds, runUnitFor } from '@/domain/running/units';
import { formatDate } from '@/lib/dates';
import { useRunInProgress } from '@/lib/useActiveRun';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function SavedRouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const route = useSavedRoute(id);
  if (route.data) return <RouteDetail route={route.data} />;
  if (route.isPending) return <LoadingView label="Loading route…" />;
  return <EmptyState title="Route not found" message="It may have been deleted." />;
}

function RouteDetail({ route }: { route: SavedRoute }) {
  const router = useRouter();
  const profile = useProfile();
  const unit = runUnitFor(profile.data?.unit ?? 'lb');
  const rename = useRenameRoute();
  const remove = useDeleteRoute();
  const runInProgress = useRunInProgress();
  const ranked = useMemo(() => rankAttempts(route.attempts), [route.attempts]);
  const best = ranked[0];

  const fail = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  const askRename = () => {
    if (Platform.OS !== 'ios') return;
    Alert.prompt(
      'Rename route',
      undefined,
      (name) => {
        if (name.trim()) rename.mutate({ id: route.id, name }, { onError: fail('Could not rename') });
      },
      'plain-text',
      route.name,
    );
  };

  const confirmDelete = () =>
    Alert.alert('Delete this route?', 'Your runs on it are kept; they just won’t be grouped as attempts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete route',
        style: 'destructive',
        onPress: () =>
          remove.mutate(route.id, { onSuccess: () => router.back(), onError: fail('Could not delete') }),
      },
    ]);

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Stack.Screen
        options={{
          title: route.name,
          headerRight:
            Platform.OS === 'ios'
              ? () => (
                  <Pressable onPress={askRename} accessibilityRole="button" accessibilityLabel="Rename route" hitSlop={12}>
                    <Text style={styles.link}>Rename</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />

      {route.line.length >= 2 ? (
        <RunMap segments={[route.line]} fitToRoute style={styles.map} accessibilityLabel={`Map of ${route.name}`} />
      ) : null}

      <View style={styles.tiles}>
        <StatTile value={formatDistance(route.distanceM, unit)} label="distance" />
        <StatTile value={best ? formatClock(best.movingSeconds) : '—'} label="best time" />
        <StatTile value={String(route.attempts.length)} label={route.attempts.length === 1 ? 'run' : 'runs'} />
      </View>

      <Button
        label={runInProgress ? 'Finish your current run first' : 'Run this route'}
        size="lg"
        disabled={runInProgress}
        onPress={() => router.push({ pathname: '/run/record', params: { routeId: route.id } })}
      />

      <Card title="Attempts">
        {ranked.length === 0 ? (
          <Text style={text.bodyMuted}>No runs on this route yet.</Text>
        ) : (
          ranked.map((a) => {
            const pace = formatPace(paceSeconds(a.distanceM, a.movingSeconds, unit), unit);
            return (
              <Pressable
                key={a.activityId}
                onPress={() => router.push(`/run/${a.activityId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${a.rank === 1 ? 'Best, ' : ''}${formatDate(a.performedAt)}, ${formatClock(a.movingSeconds)}${a.behindBest > 0 ? `, ${formatClock(a.behindBest)} behind the best` : ''}`}
                style={styles.row}
              >
                <Text style={[text.body, styles.rank, a.rank === 1 && styles.best]}>{a.rank}</Text>
                <View style={styles.flex}>
                  <Text style={text.body}>{formatDate(a.performedAt)}</Text>
                  <Text style={text.caption}>{pace}</Text>
                </View>
                <View style={styles.end}>
                  <Text style={[text.body, styles.time, a.rank === 1 && styles.best]}>{formatClock(a.movingSeconds)}</Text>
                  {a.behindBest > 0 ? <Text style={text.caption}>+{formatClock(a.behindBest)}</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </Card>

      <Button label="Delete route" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  map: { height: 240 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rank: { width: 24, color: colors.textMuted, fontWeight: '700' },
  time: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  best: { color: colors.success },
  end: { alignItems: 'flex-end' },
  link: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  flex: { flex: 1 },
});

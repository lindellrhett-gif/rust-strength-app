import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { EmptyState, LoadingView } from '@/components';
import { RunShareCard } from '@/components/share/RunShareCard';
import { SharePreview } from '@/components/share/SharePreview';
import { usePrivacyZones, useRun, useRunHistory } from '@/data/runs';
import { EFFORT_KEYS } from '@/domain/running/bestEfforts';
import { runRecords } from '@/domain/running/history';
import { buildRunCard } from '@/domain/shareCard';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** The shareable card for one saved run. */
export default function ShareRun() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useRun(id);
  const zones = usePrivacyZones();
  const history = useRunHistory();
  const [showRoute, setShowRoute] = useState(true);

  const hasRoute = (run.data?.route.length ?? 0) >= 2;

  const card = useMemo(() => {
    if (!run.data) return null;
    const r = run.data;
    // Records against every run so far; without the history, none are claimed.
    const records = history.data ? runRecords(history.data) : null;
    return buildRunCard({
      name: r.name,
      dateLabel: new Date(r.performedAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      unit: r.unit,
      distanceM: r.distanceM,
      movingSeconds: r.movingSeconds,
      elevationGainM: r.hasElevation ? r.elevationGainM : null,
      splits: r.splits,
      bestEfforts: r.bestEfforts,
      recordEfforts: records ? EFFORT_KEYS.filter((k) => records.efforts[k]?.run.id === r.id) : [],
      longest: records?.longest?.id === r.id && (history.data?.length ?? 0) > 1,
      route: r.route,
      zones: zones.data ?? [],
      // Until the privacy zones have loaded, no route: better a card without
      // one than an outline that ends at someone's front door.
      showRoute: showRoute && zones.isSuccess,
    });
  }, [run.data, history.data, zones.data, zones.isSuccess, showRoute]);

  if (run.isPending) return <LoadingView label="Loading run…" />;
  if (!card) return <EmptyState title="Run not found" message="It may have been deleted." />;

  return (
    <SharePreview
      renderCard={(ref) => <RunShareCard card={card} ref={ref} />}
      options={
        hasRoute ? (
          <View style={styles.option}>
            <View style={styles.optionText}>
              <Text style={text.body}>Show the route</Text>
              <Text style={text.caption}>
                Its shape only, no map. The first and last 200 m and your privacy zones are always
                left off.
              </Text>
            </View>
            <Switch
              value={showRoute}
              onValueChange={setShowRoute}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Show the route on the card"
            />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  optionText: { flex: 1, gap: 2 },
});

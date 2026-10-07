import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingView, NumberStepper, Screen } from '@/components';
import { DistanceBars } from '@/components/DistanceBars';
import { MonthCalendar } from '@/components/MonthCalendar';
import { useProfile } from '@/data/profile';
import { useSavedRoutes } from '@/data/routes';
import { DEFAULT_RUN_PREFERENCES, useRunHistory, useRunPreferences, useSetWeeklyGoal } from '@/data/runs';
import { formatClock } from '@/domain/duration';
import { EFFORT_KEYS, EFFORT_LABEL } from '@/domain/running/bestEfforts';
import {
  monthlyTotals,
  runRecords,
  weekGoalProgress,
  weeklyTotals,
  type HistoryRun,
} from '@/domain/running/history';
import {
  formatDistance,
  formatPace,
  fromUnit,
  paceSeconds,
  runUnitFor,
  toUnit,
  type RunDistanceUnit,
} from '@/domain/running/units';
import { weekStart } from '@/domain/stats';
import { formatDate, todayLocal } from '@/lib/dates';
import { useRunInProgress } from '@/lib/useActiveRun';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Runs listed before "Show all". */
const LIST_PREVIEW = 20;
const EMPTY = new Set<string>();

export default function RunningHub() {
  const router = useRouter();
  const profile = useProfile();
  const unit = runUnitFor(profile.data?.unit ?? 'lb');
  const history = useRunHistory();
  const prefs = useRunPreferences().data ?? DEFAULT_RUN_PREFERENCES;
  const runInProgress = useRunInProgress();
  const routes = useSavedRoutes();
  const today = todayLocal();

  const [view, setView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(today);
  const [selected, setSelected] = useState(today);
  const [showAll, setShowAll] = useState(false);

  const runs = useMemo(() => history.data ?? [], [history.data]);
  const weeks = useMemo(() => weeklyTotals(runs, today, 12), [runs, today]);
  const months = useMemo(() => monthlyTotals(runs, today, 12), [runs, today]);
  const records = useMemo(() => runRecords(runs), [runs]);
  const runDates = useMemo(() => new Set(runs.map((r) => r.date)), [runs]);
  const goal = weekGoalProgress(runs, today, prefs.weeklyGoalM);
  const thisWeek = weekStart(today);
  const weekRuns = runs.filter((r) => r.date >= thisWeek && r.date <= today);
  const weekDistance = weekRuns.reduce((s, r) => s + r.distanceM, 0);

  if (history.isPending) return <LoadingView label="Loading your runs…" />;

  const startButton = (
    <View style={styles.startButtons}>
      <Button
        label={runInProgress ? 'Resume run' : 'Start a run'}
        size="lg"
        onPress={() => router.push('/run/record')}
      />
      <Button label="Enter a run by hand" variant="ghost" onPress={() => router.push('/run/manual')} />
    </View>
  );

  if (runs.length === 0) {
    return (
      <Screen edges={['left', 'right']} contentStyle={styles.content}>
        <EmptyState
          title="No runs yet"
          message="Record a run and your weekly distance, records and history will show up here."
        />
        {startButton}
      </Screen>
    );
  }

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10));
  };
  const dayRuns = runs.filter((r) => r.date === selected);
  const listed = showAll ? runs : runs.slice(0, LIST_PREVIEW);

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/run/settings')}
              accessibilityRole="button"
              accessibilityLabel="Running settings"
              hitSlop={12}
            >
              <Text style={styles.link}>Settings</Text>
            </Pressable>
          ),
        }}
      />
      <Card title="This week">
        <View style={styles.weekRow}>
          <Text style={text.hero}>{formatDistance(weekDistance, unit)}</Text>
          <Text style={text.bodyMuted}>
            {weekRuns.length === 1 ? '1 run' : `${weekRuns.length} runs`}
          </Text>
        </View>
        <WeeklyGoal unit={unit} goalM={prefs.weeklyGoalM} progress={goal} />
      </Card>

      {startButton}

      <Card title="Distance">
        <View style={styles.segment} accessibilityRole="tablist">
          {(['week', 'month'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              style={[styles.segmentItem, view === v && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentText, view === v && styles.segmentTextOn]}>
                {v === 'week' ? 'Weekly' : 'Monthly'}
              </Text>
            </Pressable>
          ))}
        </View>
        <DistanceBars
          totals={view === 'week' ? weeks : months}
          kind={view}
          unit={unit}
          goalM={prefs.weeklyGoalM}
        />
      </Card>

      <Card title="Records">
        {EFFORT_KEYS.map((key) => {
          const record = records.efforts[key];
          return (
            <RecordRow
              key={key}
              label={EFFORT_LABEL[key]}
              value={record ? formatClock(record.seconds) : '—'}
              run={record?.run}
              onOpen={(id) => router.push(`/run/${id}`)}
            />
          );
        })}
        <RecordRow
          label="Longest run"
          value={records.longest ? formatDistance(records.longest.distanceM, unit) : '—'}
          run={records.longest ?? undefined}
          onOpen={(id) => router.push(`/run/${id}`)}
        />
        <Text style={text.caption}>
          Records come from runs recorded with GPS. The fastest stretch of each distance inside a
          run counts, not only whole races.
        </Text>
      </Card>

      <Card title="Routes">
        {(routes.data ?? []).length === 0 ? (
          <Text style={text.bodyMuted}>
            Save a run as a route from its summary to run it again and compare your times.
          </Text>
        ) : (
          (routes.data ?? []).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/run/route/${r.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${formatDistance(r.distanceM, unit)}, ${r.attempts} runs${r.bestSeconds != null ? `, best ${formatClock(r.bestSeconds)}` : ''}`}
              style={styles.row}
            >
              <View style={styles.flex}>
                <Text style={text.body} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={text.caption}>
                  {formatDistance(r.distanceM, unit)} · {r.attempts === 1 ? '1 run' : `${r.attempts} runs`}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={[text.body, styles.strong]}>{r.bestSeconds != null ? formatClock(r.bestSeconds) : '—'}</Text>
                <Text style={text.caption}>best</Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Card>
        <MonthCalendar
          month={month}
          workoutDates={EMPTY}
          activityDates={runDates}
          restDates={EMPTY}
          plannedDates={EMPTY}
          selected={selected}
          today={today}
          onSelect={setSelected}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
        />
        {dayRuns.length > 0 ? (
          dayRuns.map((r) => <RunRow key={r.id} run={r} unit={unit} onOpen={(id) => router.push(`/run/${id}`)} />)
        ) : (
          <Text style={text.bodyMuted}>No runs on {formatDate(`${selected}T12:00:00`)}.</Text>
        )}
      </Card>

      <Card title="All runs">
        {listed.map((r) => (
          <RunRow key={r.id} run={r} unit={unit} onOpen={(id) => router.push(`/run/${id}`)} />
        ))}
        {runs.length > LIST_PREVIEW ? (
          <Button
            label={showAll ? 'Show fewer' : `Show all ${runs.length}`}
            variant="ghost"
            onPress={() => setShowAll(!showAll)}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

function WeeklyGoal({
  unit,
  goalM,
  progress,
}: {
  unit: RunDistanceUnit;
  goalM: number | null;
  progress: ReturnType<typeof weekGoalProgress>;
}) {
  const setGoal = useSetWeeklyGoal();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => Math.round(toUnit(goalM ?? fromUnit(unit === 'mi' ? 15 : 25, unit), unit)));

  const save = async (value: number | null) => {
    try {
      await setGoal.mutateAsync(value == null ? null : fromUnit(value, unit));
      setEditing(false);
    } catch (e) {
      Alert.alert('Could not save the goal', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (editing) {
    return (
      <View style={styles.goalEdit}>
        <NumberStepper
          label={`Weekly goal (${unit})`}
          value={draft}
          onChange={setDraft}
          step={1}
          min={1}
          max={unit === 'mi' ? 300 : 500}
          suffix={unit}
        />
        <View style={styles.goalButtons}>
          <Button label="Save goal" onPress={() => void save(draft)} loading={setGoal.isPending} style={styles.flex} />
          <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} style={styles.flex} />
        </View>
        {goalM != null ? (
          <Button label="Remove goal" variant="ghost" onPress={() => void save(null)} />
        ) : null}
      </View>
    );
  }

  if (!progress) {
    return <Button label="Set a weekly goal" variant="secondary" onPress={() => setEditing(true)} />;
  }

  const pct = Math.round(progress.fraction * 100);
  return (
    <View style={styles.goal}>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Weekly goal ${formatDistance(progress.goalM, unit)}`}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View style={[styles.fill, { width: `${pct}%` }, progress.met && styles.fillMet]} />
      </View>
      <View style={styles.goalRow}>
        <Text style={text.bodyMuted}>
          {progress.met
            ? `Goal met: ${formatDistance(progress.goalM, unit)}`
            : `${formatDistance(progress.goalM - progress.distanceM, unit)} to go of ${formatDistance(progress.goalM, unit)}`}
        </Text>
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecordRow({
  label,
  value,
  run,
  onOpen,
}: {
  label: string;
  value: string;
  run?: HistoryRun;
  onOpen: (id: string) => void;
}) {
  const open = run?.detailed ? () => onOpen(run.id) : undefined;
  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}${run ? `, ${formatDate(run.performedAt)}` : ''}`}
      style={styles.row}
    >
      <Text style={[text.body, styles.flex]}>{label}</Text>
      <View style={styles.rowEnd}>
        <Text style={[text.body, styles.strong]}>{value}</Text>
        {run ? <Text style={text.caption}>{formatDate(run.performedAt)}</Text> : null}
      </View>
    </Pressable>
  );
}

function RunRow({ run, unit, onOpen }: { run: HistoryRun; unit: RunDistanceUnit; onOpen: (id: string) => void }) {
  const pace = formatPace(paceSeconds(run.distanceM, run.movingSeconds, unit), unit);
  const open = run.detailed ? () => onOpen(run.id) : undefined;
  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? 'button' : undefined}
      accessibilityLabel={`${run.name}, ${formatDate(run.performedAt)}, ${formatDistance(run.distanceM, unit)}, ${pace}`}
      style={styles.row}
    >
      <View style={styles.flex}>
        <Text style={text.body} numberOfLines={1}>
          {run.name}
        </Text>
        <Text style={text.caption}>{formatDate(run.performedAt)}</Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={[text.body, styles.strong]}>{formatDistance(run.distanceM, unit)}</Text>
        <Text style={text.caption}>{pace}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  startButtons: { gap: spacing.xs },
  weekRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  goal: { gap: spacing.sm },
  goalEdit: { gap: spacing.md },
  goalButtons: { flexDirection: 'row', gap: spacing.sm },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  fillMet: { backgroundColor: colors.success },
  link: { color: colors.primary, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentItemOn: { backgroundColor: colors.border },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowEnd: { alignItems: 'flex-end' },
  strong: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
});

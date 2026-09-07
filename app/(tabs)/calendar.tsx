import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, LoadingView } from '@/components';
import { Field } from '@/components/Field';
import { MonthCalendar } from '@/components/MonthCalendar';
import {
  useCreatePlannedSession,
  useDeletePlannedSession,
  usePlannedSessions,
} from '@/data/planned';
import { useActivities } from '@/data/activities';
import { useDeleteRestDay, useRestDays, useSetRestDay } from '@/data/restDays';
import { useStartWorkoutFromTemplate, useTemplates } from '@/data/templates';
import { useWorkouts } from '@/data/workouts';
import type { Workout } from '@/lib/database.types';
import { elapsedSeconds, formatDurationShort } from '@/domain/duration';
import { buildTimeline, entriesOn, type TimelineEntry } from '@/domain/timeline';
import { formatDate, formatTime, toLocalDateString, todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function CalendarScreen() {
  const router = useRouter();
  const workouts = useWorkouts();
  const planned = usePlannedSessions();
  const createPlan = useCreatePlannedSession();
  const deletePlan = useDeletePlannedSession();
  const templates = useTemplates();
  const startFromTemplate = useStartWorkoutFromTemplate();
  const activities = useActivities();
  const restDays = useRestDays();
  const setRestDay = useSetRestDay();
  const deleteRestDay = useDeleteRestDay();

  const today = todayLocal();
  const [month, setMonth] = useState(today);
  const [selected, setSelected] = useState<string>(today);
  const [planTitle, setPlanTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [planTemplateId, setPlanTemplateId] = useState<string | null>(null);

  const workoutList = workouts.data;
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of workoutList ?? []) {
      if (!w.ended_at) continue;
      const d = toLocalDateString(w.started_at);
      const list = map.get(d) ?? [];
      list.push(w);
      map.set(d, list);
    }
    return map;
  }, [workoutList]);

  const workoutDates = useMemo(() => new Set(workoutsByDate.keys()), [workoutsByDate]);
  const plannedDates = useMemo(
    () => new Set((planned.data ?? []).map((p) => p.scheduled_for)),
    [planned.data],
  );
  const activityDates = useMemo(
    () => new Set((activities.data ?? []).map((a) => toLocalDateString(a.performedAt))),
    [activities.data],
  );
  const restDates = useMemo(
    () => new Set((restDays.data ?? []).map((r) => r.rest_date)),
    [restDays.data],
  );

  // One feed for lifting, activities and rest days.
  const timeline = useMemo(
    () =>
      buildTimeline(
        (workoutList ?? []).map((w) => ({
          id: w.id,
          name: w.name,
          startedAt: w.started_at,
          endedAt: w.ended_at,
          durationSeconds: w.ended_at ? elapsedSeconds(w.started_at, w.ended_at) : 0,
          volume: 0,
          setCount: 0,
        })),
        activities.data ?? [],
        (restDays.data ?? []).map((r) => ({ id: r.id, date: r.rest_date, note: r.note })),
      ),
    [workoutList, activities.data, restDays.data],
  );

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 10));
  };

  const dayWorkouts = workoutsByDate.get(selected) ?? [];
  const dayPlans = (planned.data ?? []).filter((p) => p.scheduled_for === selected);
  const isPast = selected < today;
  const dayEntries = entriesOn(timeline, selected);
  const selectedRest = (restDays.data ?? []).find((r) => r.rest_date === selected) ?? null;

  const toggleRestDay = () => {
    if (selectedRest) deleteRestDay.mutate(selectedRest.id);
    else setRestDay.mutate({ date: selected });
  };

  const chosenTemplate = (templates.data ?? []).find((t) => t.id === planTemplateId) ?? null;

  const addPlan = () => {
    createPlan.mutate(
      {
        scheduledFor: selected,
        // Default the label to the preset name so the calendar reads well.
        title: planTitle || chosenTemplate?.name || 'Workout',
        templateId: planTemplateId,
      },
      {
        onSuccess: () => {
          setPlanTitle('');
          setPlanTemplateId(null);
          setAdding(false);
        },
      },
    );
  };

  /** Start a planned session, pre-loading its preset when it has one. */
  const startPlan = async (templateId: string | null) => {
    try {
      if (templateId) {
        const workoutId = await startFromTemplate.mutateAsync(templateId);
        router.push(`/workout/${workoutId}`);
      } else {
        router.push('/(tabs)');
      }
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (workouts.isLoading && planned.isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <MonthCalendar
            month={month}
            workoutDates={workoutDates}
            plannedDates={plannedDates}
            activityDates={activityDates}
            restDates={restDates}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
          />
        </Card>

        <Card title={formatDate(`${selected}T12:00:00`)}>
          {dayWorkouts.length === 0 && dayPlans.length === 0 ? (
            <Text style={text.bodyMuted}>
              {isPast ? 'No workout logged on this day.' : 'Nothing planned yet.'}
            </Text>
          ) : null}

          {dayWorkouts.map((w) => (
            <Pressable
              key={w.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/workout/${w.id}`)}
            >
              <View style={styles.rowMain}>
                <Text style={text.body}>Workout</Text>
                <Text style={text.caption}>
                  {formatTime(w.started_at)}
                  {w.ended_at
                    ? ` · ${formatDurationShort(elapsedSeconds(w.started_at, w.ended_at))}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}

          {dayEntries
            .filter((e) => e.kind !== 'workout')
            .map((e) => (
              <View key={e.id} style={styles.row}>
                <View
                  style={[
                    styles.kindBar,
                    { backgroundColor: e.kind === 'activity' ? colors.success : colors.textMuted },
                  ]}
                />
                <View style={styles.rowMain}>
                  <Text style={text.body}>{e.title}</Text>
                  <Text style={text.caption}>
                    {[
                      e.durationSeconds > 0 ? formatDurationShort(e.durationSeconds) : null,
                      e.detail || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            ))}

          {dayPlans.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onLongPress={() =>
                Alert.alert('Remove plan?', p.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => deletePlan.mutate(p.id),
                  },
                ])
              }
            >
              <View style={styles.rowMain}>
                <Text style={text.body}>{p.title}</Text>
                <Text style={text.caption}>
                  {p.template_id
                    ? `${(templates.data ?? []).find((t) => t.id === p.template_id)?.items.length ?? 0} exercises ready · long-press to remove`
                    : 'planned · long-press to remove'}
                </Text>
              </View>
              {p.template_id ? (
                <Pressable onPress={() => startPlan(p.template_id)} hitSlop={8}>
                  <Text style={styles.startPlan}>Start ›</Text>
                </Pressable>
              ) : (
                <View style={styles.plannedTag}>
                  <Text style={styles.plannedTagText}>PLAN</Text>
                </View>
              )}
            </Pressable>
          ))}

          {adding ? (
            <View style={styles.addBox}>
              <Field
                label="What are you training?"
                value={planTitle}
                onChangeText={setPlanTitle}
                placeholder={chosenTemplate ? chosenTemplate.name : 'e.g. Push day'}
                autoFocus
              />

              <Text style={text.label}>USE A PRESET (OPTIONAL)</Text>
              <View style={styles.presetRow}>
                <Pressable
                  onPress={() => setPlanTemplateId(null)}
                  style={[styles.presetChip, planTemplateId === null && styles.presetChipOn]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      planTemplateId === null && styles.presetChipTextOn,
                    ]}
                  >
                    None
                  </Text>
                </Pressable>
                {(templates.data ?? []).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setPlanTemplateId(t.id)}
                    style={[styles.presetChip, planTemplateId === t.id && styles.presetChipOn]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        planTemplateId === t.id && styles.presetChipTextOn,
                      ]}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {(templates.data ?? []).length === 0 ? (
                <Pressable onPress={() => router.push('/templates')}>
                  <Text style={styles.link}>Create a preset to pre-fill your exercises ›</Text>
                </Pressable>
              ) : null}

              <View style={styles.addActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
                <Button label="Add plan" onPress={addPlan} loading={createPlan.isPending} />
              </View>
            </View>
          ) : (
            <>
              <Button
                label={isPast ? '＋ Plan a session on this day' : '＋ Plan a session'}
                variant="secondary"
                onPress={() => setAdding(true)}
              />
              <Button
                label={selectedRest ? 'Remove rest day' : '😴 Mark as rest day'}
                variant={selectedRest ? 'danger' : 'ghost'}
                onPress={toggleRestDay}
                loading={setRestDay.isPending || deleteRestDay.isPending}
              />
              <Text style={text.caption}>
                A rest day keeps your streak going instead of breaking it. Plan one ahead or mark
                one after the fact.
              </Text>
            </>
          )}
        </Card>

        <Card title="Recent">
          {timeline.length === 0 ? (
            <Text style={text.bodyMuted}>
              Workouts, activities and rest days show up here.
            </Text>
          ) : (
            timeline.slice(0, 20).map((e) => <TimelineRow key={e.id} entry={e} router={router} />)
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One named row in the Recent feed, with the date underneath. */
function TimelineRow({
  entry,
  router,
}: {
  entry: TimelineEntry;
  router: ReturnType<typeof useRouter>;
}) {
  const tint =
    entry.kind === 'workout'
      ? colors.primary
      : entry.kind === 'activity'
        ? colors.success
        : colors.textMuted;

  const sub = [
    formatDate(`${entry.date}T12:00:00`),
    entry.durationSeconds > 0 ? formatDurationShort(entry.durationSeconds) : null,
    entry.detail || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => entry.workoutId && router.push(`/workout/${entry.workoutId}`)}
      disabled={!entry.workoutId}
    >
      <View style={[styles.kindBar, { backgroundColor: tint }]} />
      <View style={styles.rowMain}>
        <Text style={text.body}>{entry.title}</Text>
        <Text style={text.caption}>{sub}</Text>
      </View>
      {entry.workoutId ? <Text style={styles.chev}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kindBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowMain: { gap: 2, flexShrink: 1 },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
  plannedTag: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  plannedTagText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  startPlan: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  presetChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  presetChipTextOn: { color: colors.onPrimary },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  addBox: { gap: spacing.md, paddingTop: spacing.md },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});

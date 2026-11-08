import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { ModalScreen } from './ModalScreen';
import { NumberStepper } from './NumberStepper';
import { useSetStepGoal, useStepGoal } from '@/data/stepGoal';
import {
  STEP_GOAL_MAX,
  STEP_GOAL_MIN,
  STEP_GOAL_PRESETS,
  STEP_GOAL_STEP,
  cleanStepGoal,
  stepGoalShort,
} from '@/domain/todayTiles';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * Choosing the daily step goal from the steps tile on Today. Profile edits it
 * in place instead. The goal stays on the phone with the steps themselves.
 */
export function StepGoalSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const saved = useStepGoal();
  const save = useSetStepGoal();
  // What's been picked but not saved; the sheet opens on the saved goal.
  const [draft, setDraft] = useState<number | null>(null);
  const goal = draft ?? saved.data ?? cleanStepGoal(null);
  const setGoal = (n: number) => setDraft(cleanStepGoal(n));

  const close = () => {
    setDraft(null);
    onClose();
  };

  const done = () =>
    save.mutate(goal, {
      onSuccess: close,
      onError: () => Alert.alert('Couldn’t save the goal', 'Please try again.'),
    });

  return (
    <ModalScreen visible={visible} onRequestClose={close}>
      <View style={styles.head}>
        <Text style={text.title}>Daily step goal</Text>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={text.bodyMuted}>
          Today shows your steps out of this goal. It stays on your phone, like your steps.
        </Text>
        <NumberStepper
          label="Steps a day"
          value={goal}
          onChange={setGoal}
          step={STEP_GOAL_STEP}
          min={STEP_GOAL_MIN}
          max={STEP_GOAL_MAX}
        />
        <View style={styles.presets}>
          {STEP_GOAL_PRESETS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setGoal(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: goal === p }}
              accessibilityLabel={`${p.toLocaleString('en-US')} steps`}
              style={[styles.preset, goal === p && styles.presetOn]}
            >
              <Text style={[styles.presetText, goal === p && styles.presetTextOn]}>{stepGoalShort(p)}</Text>
            </Pressable>
          ))}
        </View>
        <Button label="Save" size="lg" onPress={done} loading={save.isPending} />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  body: { padding: spacing.lg, gap: spacing.lg },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  presetOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { color: colors.text, fontWeight: '700' },
  presetTextOn: { color: colors.onPrimary },
});

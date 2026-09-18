import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Field } from './Field';
import { LOAD_TYPES, LOAD_TYPE_HINT, LOAD_TYPE_LABEL, type LoadType } from '@/domain/loadType';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/stats';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface Props {
  visible: boolean;
  initialName?: string;
  busy?: boolean;
  onSubmit: (input: { name: string; muscleGroup: MuscleGroup; loadType: LoadType }) => void;
  onClose: () => void;
}

/** A starting guess from the name, so "Assisted Dip" arrives already set up. */
function guessLoadType(name: string): LoadType {
  const n = name.toLowerCase();
  if (n.includes('assist')) return 'assisted';
  if (/plank|\bhold\b|wall sit|dead hang|arm hang|l-sit/.test(n)) return 'timed';
  if (/push-?up|pull-?up|chin-?up|\bdips?\b|sit-?up|crunch|burpee/.test(n)) {
    return 'bodyweight';
  }
  return 'weighted';
}

export function CreateExerciseModal({ visible, initialName = '', busy, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<MuscleGroup>('chest');
  const [loadType, setLoadType] = useState<LoadType>('weighted');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setName(initialName);
        setLoadType(guessLoadType(initialName));
      }}
    >
      {/* Lifts the sheet above the keyboard instead of letting it cover the field. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.sheet}>
          <Text style={text.heading}>New exercise</Text>
          <Field label="Name" value={name} onChangeText={setName} autoFocus placeholder="e.g. Incline Machine Press" />

          <Text style={text.label}>TYPE</Text>
          <View style={styles.groups}>
            {LOAD_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setLoadType(t)}
                style={[styles.chip, loadType === t && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: loadType === t }}
              >
                <Text style={[styles.chipText, loadType === t && styles.chipTextActive]}>
                  {LOAD_TYPE_LABEL[t]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={text.caption}>{LOAD_TYPE_HINT[loadType]}</Text>

          <Text style={text.label}>MUSCLE GROUP</Text>
          <View style={styles.groups}>
            {MUSCLE_GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGroup(g)}
                style={[styles.chip, group === g && styles.chipActive]}
              >
                <Text style={[styles.chipText, group === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button
              label="Add"
              onPress={() =>
                name.trim() && onSubmit({ name: name.trim(), muscleGroup: group, loadType })
              }
              loading={busy}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.onPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
});

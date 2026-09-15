import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Field } from './Field';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/stats';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface Props {
  visible: boolean;
  initialName?: string;
  busy?: boolean;
  onSubmit: (input: { name: string; muscleGroup: MuscleGroup }) => void;
  onClose: () => void;
}

export function CreateExerciseModal({ visible, initialName = '', busy, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<MuscleGroup>('chest');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setName(initialName)}
    >
      {/* Lifts the sheet above the keyboard instead of letting it cover the field. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.sheet}>
          <Text style={text.heading}>New exercise</Text>
          <Field label="Name" value={name} onChangeText={setName} autoFocus placeholder="e.g. Incline Machine Press" />
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
              onPress={() => name.trim() && onSubmit({ name: name.trim(), muscleGroup: group })}
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

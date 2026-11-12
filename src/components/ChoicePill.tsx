import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export interface Choice<T extends string> {
  id: T;
  label: string;
}

/** A pill showing the current choice; tapping it lists the others. */
export function ChoicePill<T extends string>({
  title,
  value,
  choices,
  onChange,
}: {
  /** Names what's being chosen, for the list's heading and for VoiceOver. */
  title: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const current = choices.find((c) => c.id === value)?.label ?? '';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current}. Change.`}
      >
        <Text style={styles.pillText} numberOfLines={1}>
          {current}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={[text.label, styles.heading]}>{title.toUpperCase()}</Text>
            {choices.map((choice) => {
              const on = choice.id === value;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => {
                    onChange(choice.id);
                    close();
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[text.body, on && styles.rowOn]}>{choice.label}</Text>
                  {on ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pillPressed: { backgroundColor: colors.primaryPressed },
  pillText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: { padding: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowOn: { color: colors.primary, fontWeight: '700' },
});

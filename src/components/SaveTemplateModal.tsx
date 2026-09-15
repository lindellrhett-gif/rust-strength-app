import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Field } from './Field';
import { normalizeTemplateName } from '@/domain/templates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface Props {
  visible: boolean;
  busy?: boolean;
  /** Shown so the user can see what they're about to save. */
  exerciseNames: string[];
  initialName?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function SaveTemplateModal({
  visible,
  busy,
  exerciseNames,
  initialName = '',
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName);
  const clean = normalizeTemplateName(name);

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
          <Text style={text.heading}>Save as preset</Text>
          <Text style={text.bodyMuted}>
            Reuse this list of exercises any time — plan it on your calendar or start it straight
            from the Today tab.
          </Text>

          <Field
            label="Preset name"
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="e.g. Push Day 1"
            maxLength={60}
          />

          {exerciseNames.length > 0 ? (
            <View style={styles.preview}>
              <Text style={text.label}>WILL INCLUDE</Text>
              {exerciseNames.map((n, i) => (
                <Text key={`${n}-${i}`} style={text.caption}>
                  {i + 1}. {n}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={text.caption}>
            Saving over an existing name replaces that preset&apos;s exercises.
          </Text>

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button
              label="Save preset"
              onPress={() => clean && onSubmit(clean)}
              disabled={!clean}
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
  preview: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

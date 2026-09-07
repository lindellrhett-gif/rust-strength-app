import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Field } from './Field';
import { NumberStepper } from './NumberStepper';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface Props {
  visible: boolean;
  initialLabel?: string;
  busy?: boolean;
  onSubmit: (input: { label: string; increment: number }) => void;
  onClose: () => void;
}

export function CreateMachineModal({ visible, initialLabel = '', busy, onSubmit, onClose }: Props) {
  const [label, setLabel] = useState(initialLabel);
  const [increment, setIncrement] = useState(5);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setLabel(initialLabel);
        setIncrement(5);
      }}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          <Text style={text.heading}>New machine</Text>
          <Field
            label="Label"
            value={label}
            onChangeText={setLabel}
            autoFocus
            placeholder="e.g. Planet Fitness leg press"
          />
          <NumberStepper
            label="Smallest weight step"
            value={increment}
            onChange={setIncrement}
            step={2.5}
            min={0.5}
            max={50}
            precision={1}
            suffix="per step"
          />
          <Text style={text.caption}>
            Used to round weight suggestions to something you can actually set on this machine.
          </Text>
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button
              label="Add"
              onPress={() => label.trim() && onSubmit({ label: label.trim(), increment })}
              loading={busy}
            />
          </View>
        </SafeAreaView>
      </View>
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

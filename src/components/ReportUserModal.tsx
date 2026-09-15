import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Field } from './Field';
import { REPORT_REASON_LABEL, type ReportReason } from '@/data/privacy';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const REASONS = Object.keys(REPORT_REASON_LABEL) as ReportReason[];

interface Props {
  visible: boolean;
  username: string;
  busy?: boolean;
  onSubmit: (reason: ReportReason, details: string) => void;
  onClose: () => void;
}

export function ReportUserModal({ visible, username, busy, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setReason('harassment');
        setDetails('');
      }}
    >
      {/* Lifts the sheet above the keyboard instead of letting it cover the field. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.sheet}>
          <Text style={text.heading}>Report @{username}</Text>
          <Text style={text.bodyMuted}>
            We review every report. You can also block this person, which removes any friendship
            and hides you from each other.
          </Text>

          <Text style={text.label}>WHAT&apos;S WRONG?</Text>
          <View style={styles.reasons}>
            {REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.chip, reason === r && styles.chipOn]}
              >
                <Text style={[styles.chipText, reason === r && styles.chipTextOn]}>
                  {REPORT_REASON_LABEL[r]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            label="Anything else? (optional)"
            value={details}
            onChangeText={setDetails}
            placeholder="What happened"
            multiline
            maxLength={1000}
          />

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button
              label="Submit report"
              variant="danger"
              onPress={() => onSubmit(reason, details)}
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
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.text },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

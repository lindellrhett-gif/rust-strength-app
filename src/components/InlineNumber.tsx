import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardDoneBar } from './KeyboardDoneBar';
import { parseInlineNumber } from '@/domain/inlineEdit';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

interface InlineNumberProps {
  value: number | null;
  /** Called when editing ends with a different number; null only if `clearable`. */
  onCommit: (next: number | null) => void;
  /** Read out by VoiceOver, since the row's label is a separate element. */
  label: string;
  min: number;
  max: number;
  precision?: number;
  suffix?: string;
  /** Empty the field to clear the value, rather than keep the old one. */
  clearable?: boolean;
  /** Show 10,000 rather than 10000. */
  grouped?: boolean;
  /** Lets a row focus this field when any part of the row is tapped. */
  inputRef?: RefObject<TextInput | null>;
}

/**
 * A number you tap and type over where it sits, with no Save button or second
 * screen. It saves when editing ends: Done on the keyboard, or tapping away.
 *
 * A draft exists only once something has been typed, so leaving without typing
 * saves nothing and can't write an old number back.
 */
export function InlineNumber({
  value,
  onCommit,
  label,
  min,
  max,
  precision = 0,
  suffix,
  clearable = false,
  grouped = false,
  inputRef,
}: InlineNumberProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const accessoryId = `inline-number-done-${useId()}`;
  const ownRef = useRef<TextInput>(null);
  const field = inputRef ?? ownRef;
  const focused = useRef(false);

  const resting = value == null ? '' : grouped ? value.toLocaleString('en-US') : String(value);

  // The value can change while the field is focused but untouched, as when
  // tapping from one end of the rep range straight to the other. Replacing the
  // text clears the selection, so select again, or typing would join the digits.
  useEffect(() => {
    if (focused.current && draft == null) field.current?.setSelection(0, resting.length);
  }, [resting, draft, field]);

  const commit = () => {
    focused.current = false;
    if (draft == null) return;
    setDraft(null);
    if (draft.trim() === '') {
      if (clearable && value != null) onCommit(null);
      return;
    }
    const typed = grouped ? draft.replace(/,/g, '') : draft;
    const next = parseInlineNumber(typed, { min, max, precision });
    if (next != null && next !== value) onCommit(next);
  };

  return (
    <View style={styles.box}>
      <TextInput
        ref={field}
        value={draft ?? resting}
        onChangeText={setDraft}
        onFocus={() => {
          focused.current = true;
        }}
        // Blur only: iOS sends end-editing and blur in one batch, and answering
        // both would save twice.
        onBlur={commit}
        placeholder="—"
        placeholderTextColor={colors.textFaint}
        keyboardType={precision > 0 ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        style={styles.input}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        accessibilityLabel={label}
      />
      <KeyboardDoneBar nativeID={accessoryId} />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  // The field fills the box, so a tap anywhere on the number lands in it.
  input: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 48,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  suffix: { color: colors.textMuted, fontSize: 13, fontWeight: '600', paddingRight: spacing.sm },
});

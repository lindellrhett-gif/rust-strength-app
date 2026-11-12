import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HelpButton } from './HelpButton';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export interface HelpContent {
  title: string;
  body: string | string[];
}

/** A section's small heading, with its ? and an optional link at the far end. */
export function SectionHeader({
  title,
  help,
  action,
}: {
  title: string;
  help?: HelpContent;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Text style={text.label}>{title.toUpperCase()}</Text>
      {help ? <HelpButton title={help.title} body={help.body} /> : null}
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

/** Rows joined into one rounded block under a heading. */
export function SettingGroup({
  title,
  help,
  action,
  footer,
  children,
}: {
  title?: string;
  help?: HelpContent;
  action?: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? <SectionHeader title={title} help={help} action={action} /> : null}
      <View style={styles.group}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

interface SettingRowProps {
  label: string;
  help?: HelpContent;
  /** Plain text at the right, like "4" or "2 min · auto". */
  value?: string;
  /** Tapping the row opens something; a chevron shows it. */
  onPress?: () => void;
  /** Tapping the row focuses the field inside it; no chevron. */
  onPressField?: () => void;
  /** A control at the right: a switch, a number, a segment. */
  children?: ReactNode;
}

/**
 * One line of a settings block. The label stays short and everything
 * explanatory lives behind its ?.
 */
export function SettingRow({ label, help, value, onPress, onPressField, children }: SettingRowProps) {
  const body = (
    <>
      {/* Next to a value the label wraps if it must, and the value keeps a capped share. */}
      <View style={[styles.labelWrap, value ? styles.labelBesideValue : null]}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {help ? <HelpButton title={help.title} body={help.body} /> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {children}
      {onPress ? <Text style={styles.chev}>›</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${value}` : label}
      >
        {body}
      </Pressable>
    );
  }
  if (onPressField) {
    // Not accessible as a whole, or VoiceOver couldn't reach the field and the ?.
    return (
      <Pressable style={styles.row} onPress={onPressField} accessible={false}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 22 },
  headerAction: { marginLeft: 'auto' },
  group: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  footer: text.caption,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    // The first row's border slides under the block's own edge.
    marginTop: -1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  labelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelBesideValue: { flex: 0, flexGrow: 1, flexShrink: 1 },
  label: { ...text.body, flexShrink: 1 },
  value: { ...text.body, color: colors.textMuted, flexShrink: 0, maxWidth: '55%' },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
});

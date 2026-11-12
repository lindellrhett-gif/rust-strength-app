import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { keyboardAware } from './keyboard';
import { ModalScreen } from './ModalScreen';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** The sheet a settings row opens when its choice is too big to fit on the row. */
export function SettingsSheet({
  visible,
  title,
  onClose,
  closeLabel = 'Done',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  return (
    <ModalScreen visible={visible} onRequestClose={onClose}>
      <View style={styles.head}>
        <Text style={[text.title, styles.title]} numberOfLines={2}>
          {title}
        </Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.close}>{closeLabel}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} {...keyboardAware}>
        {children}
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1 },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  body: { padding: spacing.lg, gap: spacing.lg },
});

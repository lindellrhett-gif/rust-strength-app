import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface HelpButtonProps {
  /** Names the topic: the popup's heading and the button's spoken label. */
  title: string;
  /** Paragraphs of help. */
  body?: string | string[];
  /** Anything that isn't words, like a colour key. */
  children?: ReactNode;
}

/**
 * The small ? beside a setting or section. Explanations that used to sit on the
 * screen all the time open from here instead, so a screen shows its values and
 * only says what they mean when someone asks.
 */
export function HelpButton({ title, body, children }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const paragraphs = body == null ? [] : Array.isArray(body) ? body : [body];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        style={({ pressed }) => [styles.mark, pressed && styles.markPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Help: ${title}`}
      >
        <Text style={styles.markText} maxFontSizeMultiplier={1.2}>
          ?
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.backdrop}>
          {/* Behind the card, so tapping the words doesn't close it. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close help"
          />
          <View style={styles.card} accessibilityViewIsModal>
            {/* Long help at a large text size scrolls, with Got it always in reach. */}
            <ScrollView style={styles.scroller} contentContainerStyle={styles.words}>
              <Text style={text.heading}>{title}</Text>
              {paragraphs.map((p) => (
                <Text key={p} style={text.bodyMuted}>
                  {p}
                </Text>
              ))}
              {children}
            </ScrollView>
            <Button label="Got it" variant="secondary" onPress={close} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markPressed: { backgroundColor: colors.surfaceRaised },
  markText: { color: colors.textMuted, fontSize: 12, fontWeight: '800', lineHeight: 15 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    maxHeight: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  words: { gap: spacing.md },
});

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Alert, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../Button';
import { CARD_SIZE } from '@/domain/shareCard';
import { captureCard, saveImageToPhotos, shareImage } from '@/lib/shareImage';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * A share card shown as large as fits, with Share and Save to Photos. The
 * card is laid out at its real size and scaled down for the preview, so the
 * image exported is the full 1080 x 1920 whatever the screen.
 */
export function SharePreview({
  renderCard,
  options,
}: {
  renderCard: (ref: RefObject<View | null>) => ReactNode;
  /** Switches shown under the preview, like hiding a run's route. */
  options?: ReactNode;
}) {
  const ref = useRef<View>(null);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [saved, setSaved] = useState(false);

  const onLayout = (e: LayoutChangeEvent) =>
    setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const scale = area
    ? Math.min(1, (area.width - spacing.lg * 2) / CARD_SIZE.width, (area.height - spacing.lg) / CARD_SIZE.height)
    : 0;

  const run = async (kind: 'share' | 'save') => {
    if (busy) return;
    setBusy(kind);
    try {
      const uri = await captureCard(ref);
      if (kind === 'share') {
        await shareImage(uri);
      } else {
        await saveImageToPhotos(uri);
        setSaved(true);
      }
    } catch (e) {
      Alert.alert(
        kind === 'share' ? 'Couldn’t share the card' : 'Couldn’t save the card',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.previewArea} onLayout={onLayout}>
        {scale > 0 ? (
          <View
            style={[styles.frame, { width: CARD_SIZE.width * scale, height: CARD_SIZE.height * scale }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Preview of the card to share"
          >
            <View style={[styles.full, { transform: [{ scale }] }]}>{renderCard(ref)}</View>
          </View>
        ) : null}
      </View>

      {options}

      <View style={styles.footer}>
        <Button label="Share" size="lg" onPress={() => void run('share')} loading={busy === 'share'} disabled={busy === 'save'} />
        <Button
          label={saved ? 'Saved to Photos' : 'Save to Photos'}
          variant="secondary"
          onPress={() => void run('save')}
          loading={busy === 'save'}
          disabled={saved || busy === 'share'}
        />
        <Text style={[text.caption, styles.hint]}>
          Share opens Instagram, Messages and your other apps. The image is made on your phone and
          goes only where you send it.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.lg },
  frame: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  full: {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    transformOrigin: 'top left',
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  hint: { textAlign: 'center' },
});

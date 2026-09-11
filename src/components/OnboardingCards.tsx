import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { TrophyIcon } from './TrophyIcon';
import {
  ONBOARDING_CARDS,
  clampCardIndex,
  isLastCard,
  primaryLabel,
} from '@/domain/onboarding';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface OnboardingCardsProps {
  visible: boolean;
  onDone: () => void;
}

/**
 * The welcome cards, shown once after the first sign-in.
 *
 * Swipe or tap through. There is a Skip in the corner throughout, because an
 * intro someone cannot escape is worse than one they never read.
 */
export function OnboardingCards({ visible, onDone }: OnboardingCardsProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const goTo = (next: number) => {
    const target = clampCardIndex(next);
    setIndex(target);
    scroller.current?.scrollTo({ x: target * width, animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    setIndex(clampCardIndex(event.nativeEvent.contentOffset.x / width));
  };

  const finish = () => {
    setIndex(0);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Text style={text.label}>WELCOME TO RUST STRENGTH</Text>
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.pager}
        >
          {ONBOARDING_CARDS.map((card) => (
            <View key={card.id} style={[styles.card, { width }]}>
              <TrophyIcon glyph={card.glyph} tier="silver" size={86} />
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.body}>{card.body}</Text>
              {card.footnote ? <Text style={styles.footnote}>{card.footnote}</Text> : null}
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {ONBOARDING_CARDS.map((card, i) => (
            <Pressable
              key={card.id}
              onPress={() => goTo(i)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Card ${i + 1} of ${ONBOARDING_CARDS.length}`}
              accessibilityState={{ selected: i === index }}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Button
            label={primaryLabel(index)}
            size="lg"
            onPress={() => (isLastCard(index) ? finish() : goTo(index + 1))}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  skip: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },

  pager: { flex: 1 },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  footnote: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 22 },

  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

import { StyleSheet, Text, View } from 'react-native';

import { ProCard } from '@/components/ProCard';
import { spacing, text } from '@/theme/typography';

/**
 * What the food diary shows to someone without Pro, once subscriptions are
 * on. Until then nobody sees this: Pro features are open to everyone.
 */
export function NutritionLocked() {
  return (
    <View style={styles.wrap}>
      <Text style={text.title}>Food diary</Text>
      <Text style={text.bodyMuted}>
        Log meals, scan barcodes and track calories and macros next to your training. The food diary is part of
        Rust Strength Pro.
      </Text>
      <ProCard />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});

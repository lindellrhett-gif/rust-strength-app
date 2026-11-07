import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownView } from '@/components/MarkdownView';
import { HEALTH_DATA_POLICY } from '@/legal/healthData';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/** The Consumer Health Data Privacy Policy, from Profile > Privacy & legal. */
export default function HealthDataScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Health Data Policy' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <MarkdownView source={HEALTH_DATA_POLICY} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});

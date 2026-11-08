import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownView } from '@/components/MarkdownView';
import { PRIVACY_POLICY_FR } from '@/legal/fr/privacy';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

export default function PrivacyFrScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Politique de confidentialité' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <MarkdownView source={PRIVACY_POLICY_FR} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});

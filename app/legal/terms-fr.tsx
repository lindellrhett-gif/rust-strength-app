import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownView } from '@/components/MarkdownView';
import { TERMS_OF_SERVICE_FR } from '@/legal/fr/terms';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

export default function TermsFrScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Conditions d’utilisation' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <MarkdownView source={TERMS_OF_SERVICE_FR} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});

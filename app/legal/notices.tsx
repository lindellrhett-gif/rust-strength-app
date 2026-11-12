import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownView } from '@/components/MarkdownView';
import { THIRD_PARTY_NOTICES } from '@/legal/notices';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/** The food data the app uses and the licences of the open-source software in it. */
export default function NoticesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <MarkdownView source={THIRD_PARTY_NOTICES} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});

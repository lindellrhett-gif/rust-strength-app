import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * "Version française" links to the French Terms and Privacy Policy, beside
 * the English ones wherever someone is asked to agree. Quebec's Charter of the
 * French language (s 55) requires the French version of a contract like the
 * Terms to be given to the person before they agree; both are equally valid.
 */
export function FrenchLegalLinks() {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Text style={styles.lead}>Version française :</Text>
      <Pressable onPress={() => router.push('/legal/terms-fr')} hitSlop={6}>
        <Text style={styles.link}>Conditions d’utilisation</Text>
      </Pressable>
      <Text style={styles.dot}>·</Text>
      <Pressable onPress={() => router.push('/legal/privacy-fr')} hitSlop={6}>
        <Text style={styles.link}>Confidentialité</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  lead: { color: colors.textMuted, fontSize: 13 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  dot: { color: colors.textFaint },
});

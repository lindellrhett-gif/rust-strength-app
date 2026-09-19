import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Screen } from './Screen';
import { useAcceptTerms } from '@/data/privacy';
import { consentHeading, type ConsentRecord } from '@/domain/consent';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * Shown instead of the app when a signed-in user has no consent on record, or
 * accepted a version of the documents that has since changed materially.
 *
 * Same two confirmations as sign-up, recorded the same way. The only way past
 * it is to agree or to sign out — the documents can be read from here first.
 */
export function ConsentScreen({
  record,
  onAccepted,
}: {
  record: ConsentRecord;
  /** Called once the agreement is saved, so the app opens straight away. */
  onAccepted: (version: string) => void;
}) {
  const router = useRouter();
  const { signOut } = useAuth();
  const accept = useAcceptTerms();
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);

  const agree = () => {
    accept.mutate(undefined, {
      onSuccess: (accepted) => onAccepted(accepted.terms_version),
      onError: (error) =>
        Alert.alert(
          'Could not save',
          error instanceof Error && error.message
            ? error.message
            : 'Check your connection and try again.',
        ),
    });
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={text.hero}>{consentHeading(record)}</Text>
        <Text style={text.bodyMuted}>
          {record.termsVersion
            ? 'Please read the current versions and agree to keep using the app.'
            : 'Please confirm the following to use the app.'}
        </Text>
      </View>

      <View style={styles.links}>
        <Pressable onPress={() => router.push('/legal/terms')} hitSlop={6}>
          <Text style={styles.link}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={() => router.push('/legal/privacy')} hitSlop={6}>
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <Checkbox
          checked={ageOk}
          onToggle={() => setAgeOk((v) => !v)}
          label={`I am at least ${LEGAL.minimumAge} years old`}
        />
        <Checkbox
          checked={termsOk}
          onToggle={() => setTermsOk((v) => !v)}
          label="I agree to the Terms of Service and Privacy Policy"
        />
        <Button
          label="Continue"
          size="lg"
          onPress={agree}
          loading={accept.isPending}
          disabled={!ageOk || !termsOk}
        />
        <Pressable onPress={() => void signOut()} hitSlop={8} style={styles.signOut}>
          <Text style={text.bodyMuted}>Sign out instead</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl },
  links: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  dot: { color: colors.textFaint },
  form: { gap: spacing.lg },
  signOut: { alignSelf: 'center' },
});

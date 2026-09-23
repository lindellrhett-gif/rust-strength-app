import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { UNCONFIRMED_MESSAGE, isUnconfirmedEmail } from '@/domain/authErrors';
import { confirmErrorMessage } from '@/domain/emailConfirm';
import { RESEND_COOLDOWN_SECONDS } from '@/domain/passwordReset';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignIn() {
  const { signIn, resendConfirmation } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when sign-in failed only because the email is unconfirmed.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setUnconfirmed(false);
    setBusy(true);
    try {
      // The (auth) layout redirects into the tabs once the session lands.
      await signIn(email.trim(), password);
    } catch (e) {
      if (isUnconfirmedEmail(e)) {
        setUnconfirmed(true);
        setError(UNCONFIRMED_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : 'Could not sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setError(null);
      setNotice(`Sent. Check ${email.trim()} for a confirmation code, including spam.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(confirmErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const enterCode = () =>
    router.push({ pathname: '/(auth)/confirm-email', params: { email: email.trim() } });

  // Carries over whatever was typed, so nobody enters their email twice.
  const forgot = () =>
    router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } });

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={text.hero}>Welcome back</Text>
        <Text style={text.bodyMuted}>Log a set, get your next weight.</Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Pressable onPress={forgot} hitSlop={8} accessibilityRole="button" style={styles.forgot}>
          <Text style={styles.linkAccent}>Forgot password?</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {unconfirmed ? (
          <>
            <Button label="Enter confirmation code" variant="secondary" onPress={enterCode} />
            <Button
              label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Email me a new code'}
              variant="ghost"
              onPress={resend}
              loading={resending}
              disabled={cooldown > 0}
            />
          </>
        ) : null}
        <Button label="Sign in" onPress={submit} loading={busy} size="lg" />
      </View>

      <Link href="/(auth)/sign-up" style={styles.link}>
        <Text style={text.bodyMuted}>New here? </Text>
        <Text style={styles.linkAccent}>Create an account</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.md },
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  error: { color: '#F26D6D', fontSize: 14 },
  notice: { color: '#9AA7B4', fontSize: 14 },
  link: { marginTop: spacing.md, textAlign: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});

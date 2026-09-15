import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // The (auth) layout redirects into the tabs once the session lands.
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

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
  link: { marginTop: spacing.md, textAlign: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});

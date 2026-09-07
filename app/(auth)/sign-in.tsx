import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignIn() {
  const { signIn } = useAuth();
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

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Sign in" onPress={submit} loading={busy} size="lg" />
        </View>

        <Link href="/(auth)/sign-up" style={styles.link}>
          <Text style={text.bodyMuted}>New here? </Text>
          <Text style={styles.linkAccent}>Create an account</Text>
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  error: { color: '#F26D6D', fontSize: 14 },
  link: { marginTop: spacing.xl, textAlign: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});

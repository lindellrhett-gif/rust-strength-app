import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import {
  RESEND_COOLDOWN_SECONDS,
  codeSentMessage,
  looksLikeEmail,
  newPasswordProblem,
  normalizeCode,
  normalizeEmail,
  resetErrorMessage,
} from '@/domain/passwordReset';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

type Step = 'email' | 'code';

/**
 * The friendly message, plus — in development only — what Supabase actually
 * said. "Something went wrong" is right for users and useless for working out
 * why an email did not send (usually SMTP settings or the email template).
 */
function describeError(error: unknown): string {
  const friendly = resetErrorMessage(error);
  if (!__DEV__) return friendly;
  const e = (typeof error === 'object' && error !== null ? error : {}) as {
    message?: string;
    code?: string;
    status?: number;
  };
  console.warn('Password reset failed', error);
  const detail = [e.status, e.code, e.message].filter(Boolean).join(' | ');
  return detail ? `${friendly}\n\n[dev] ${detail}` : friendly;
}

/**
 * Forgotten password: request a code by email, then enter it with a new
 * password. Two steps on one screen so a person who leaves to read their email
 * comes back to exactly where they were.
 */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { sendResetCode, verifyResetCode, setNewPassword, abandonReset } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Set once the code has been accepted. A failed password update after that
  // must not ask for the code again — it has been used up.
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = async () => {
    setError(null);
    if (!looksLikeEmail(email)) {
      setError('Enter the email address you signed up with.');
      return;
    }
    setBusy(true);
    try {
      await sendResetCode(normalizeEmail(email));
      setNotice(codeSentMessage(email));
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    const problem = newPasswordProblem({ code, password, confirm, codeAlreadyVerified: verified });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      if (!verified) {
        await verifyResetCode(normalizeEmail(email), normalizeCode(code));
        setVerified(true);
      }
      // Once this resolves the auth layout lets go and the app opens, signed in
      // with the new password.
      await setNewPassword(password);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  // However the screen is left — the link below or a swipe back — a reset
  // whose code was used but whose password was never saved is ended, so nobody
  // is left half signed in on the sign-in screen. After a successful reset this
  // does nothing.
  const abandonRef = useRef(abandonReset);
  useEffect(() => {
    abandonRef.current = abandonReset;
  }, [abandonReset]);
  useEffect(() => () => void abandonRef.current(), []);

  const leave = async () => {
    await abandonReset();
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setNotice(null);
    setError(null);
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={text.hero}>Reset password</Text>
        <Text style={text.bodyMuted}>
          {step === 'email'
            ? 'We will email you a code to set a new password.'
            : verified
              ? 'Code accepted. Choose your new password.'
              : 'Enter the code from the email and choose a new password.'}
        </Text>
      </View>

      {step === 'email' ? (
        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={send}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Send code" onPress={send} loading={busy} size="lg" />
        </View>
      ) : (
        <View style={styles.form}>
          {notice && !verified ? <Text style={styles.notice}>{notice}</Text> : null}
          {verified ? null : (
            <Field
              label="Code"
              value={code}
              onChangeText={(v: string) => setCode(normalizeCode(v))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
            />
          )}
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={reset}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Set new password" onPress={reset} loading={busy} size="lg" />

          {verified ? null : (
            <View style={styles.row}>
              <Pressable
                onPress={send}
                disabled={cooldown > 0 || busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={cooldown > 0 ? styles.linkDisabled : styles.link}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Text>
              </Pressable>
              <Pressable onPress={changeEmail} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Use a different email</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" style={styles.back}>
        <Text style={text.bodyMuted}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.md },
  form: { gap: spacing.lg },
  error: { color: colors.danger, fontSize: 14 },
  notice: { color: colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  link: { color: colors.primary, fontWeight: '700' },
  linkDisabled: { color: colors.textFaint, fontWeight: '700' },
  back: { alignSelf: 'center', marginTop: spacing.lg },
});

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field } from '@/components';
import { keyboardAware } from '@/components/keyboard';
import {
  useBlockedUsers,
  useDeleteMyAccount,
  useExportMyData,
  useUnblockUser,
} from '@/data/privacy';
import { LEGAL } from '@/legal/config';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * One place for everything a user needs to exercise their privacy rights:
 * read the documents, take their data with them, manage who they've blocked,
 * and delete the account outright.
 */
export default function PrivacyCenter() {
  const router = useRouter();
  const exportData = useExportMyData();
  const deleteAccount = useDeleteMyAccount();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  const [confirmText, setConfirmText] = useState('');
  const [confirming, setConfirming] = useState(false);

  const doExport = async () => {
    try {
      const json = await exportData.mutateAsync();
      // Share sheet lets the user send it to Files, Mail, anywhere they like.
      await Share.share({
        title: 'My Gym App data',
        message: json,
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const doDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and every workout, activity, preset and stat in it. It cannot be undone and we cannot restore it.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync();
              router.replace('/(auth)/sign-in');
            } catch (e) {
              Alert.alert(
                'Could not delete',
                e instanceof Error ? e.message : 'Please try again, or email us.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Privacy & legal' }} />

      <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
        <Card title="Documents">
          <LinkRow label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
          <LinkRow label="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <Text style={text.caption}>Version {LEGAL.version} · updated {LEGAL.lastUpdated}</Text>
        </Card>

        <Card title="Your data">
          <Text style={text.bodyMuted}>
            Download everything we hold about you as a JSON file — your profile, workouts, sets,
            activities, presets and friends.
          </Text>
          <Button
            label="Download my data"
            variant="secondary"
            onPress={doExport}
            loading={exportData.isPending}
          />
        </Card>

        <Card title="Blocked users">
          {blocked.isLoading ? (
            <Text style={text.bodyMuted}>Loading…</Text>
          ) : (blocked.data ?? []).length === 0 ? (
            <Text style={text.bodyMuted}>
              You haven&apos;t blocked anyone. Blocking someone removes any friendship and hides you
              from each other.
            </Text>
          ) : (
            (blocked.data ?? []).map((b) => (
              <View key={b.id} style={styles.blockRow}>
                <Text style={text.body}>@{b.username ?? 'unknown'}</Text>
                <Pressable onPress={() => unblock.mutate(b.id)} hitSlop={8}>
                  <Text style={styles.unblock}>Unblock</Text>
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Card title="Contact">
          <Text style={text.bodyMuted}>
            Questions about your privacy, or a request we haven&apos;t covered here? Email us and
            we&apos;ll get back to you.
          </Text>
          <Text style={styles.email}>{LEGAL.contactEmail}</Text>
        </Card>

        <Card title="Delete account">
          <Text style={text.bodyMuted}>
            This permanently deletes your account and all of your data. It cannot be undone.
            Consider downloading your data first.
          </Text>

          {confirming ? (
            <>
              <Field
                label='Type DELETE to confirm'
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="DELETE"
              />
              <View style={styles.deleteRow}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setConfirming(false);
                    setConfirmText('');
                  }}
                />
                <Button
                  label="Delete my account"
                  variant="danger"
                  onPress={doDelete}
                  disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
                  loading={deleteAccount.isPending}
                />
              </View>
            </>
          ) : (
            <Button label="Delete my account" variant="danger" onPress={() => setConfirming(true)} />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.linkPressed]} onPress={onPress}>
      <Text style={text.body}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkPressed: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  chev: { color: colors.textFaint, fontSize: 20 },
  blockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  unblock: { color: colors.primary, fontWeight: '700' },
  email: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});

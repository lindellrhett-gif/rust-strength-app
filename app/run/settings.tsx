import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Screen } from '@/components';
import {
  DEFAULT_RUN_PREFERENCES,
  usePrivacyZones,
  useRunPreferences,
  useUpdateRunPreferences,
  type RunPreferences,
} from '@/data/runs';
import { lastLockScreenProblem, lockScreenAvailability } from '@/lib/lockScreen';
import { useAppActive } from '@/lib/useAppActive';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function RunSettingsScreen() {
  const router = useRouter();
  const prefs = useRunPreferences().data ?? DEFAULT_RUN_PREFERENCES;
  const zones = usePrivacyZones();
  const update = useUpdateRunPreferences();

  const set = (patch: Partial<RunPreferences>) =>
    update.mutate(
      { ...prefs, ...patch },
      {
        onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.'),
      },
    );

  const zoneCount = zones.data?.length ?? 0;
  // Read again on coming back from Settings, where it may have been switched on.
  useAppActive();
  const lockScreen = lockScreenAvailability();
  const problem = __DEV__ ? lastLockScreenProblem() : null;

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Card title="Recording">
        <Row
          label="Auto-pause"
          caption="Pause the clock when you stop, like at a light."
          value={prefs.autoPause}
          onChange={(v) => set({ autoPause: v })}
        />
        <Row
          label="Spoken updates"
          caption="Hear your distance and pace every mile or kilometre."
          value={prefs.audioCues}
          onChange={(v) => set({ audioCues: v })}
        />
      </Card>

      <Card title="Lock Screen">
        <Text style={text.bodyMuted}>
          {lockScreen === 'on'
            ? 'A run, and the rest timer between sets, show on the Lock Screen and in the Dynamic Island while they are going.'
            : lockScreen === 'off'
              ? 'Turned off for this app. Turn on Live Activities in Settings to see your run and rest timer on the Lock Screen.'
              : 'This version of the app can’t show your run or rest timer on the Lock Screen. Update the app to get it.'}
        </Text>
        {problem ? <Text style={text.caption}>Last problem: {problem}</Text> : null}
        {lockScreen !== 'missing' ? (
          <Pressable
            style={styles.linkRow}
            onPress={() => Linking.openSettings().catch(() => undefined)}
            accessibilityRole="button"
          >
            <Text style={text.body}>{lockScreen === 'off' ? 'Turn on in Settings' : 'Open Settings'}</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card title="Sharing new runs">
        <Row
          label="Share to friends’ feed"
          caption="You can change it on any run afterwards."
          value={prefs.shareDefault}
          onChange={(v) => set({ shareDefault: v })}
        />
        <Row
          label="Show the map to friends"
          caption="Off means friends see distance, time and pace only."
          value={prefs.mapDefault === 'friends'}
          disabled={!prefs.shareDefault}
          onChange={(v) => set({ mapDefault: v ? 'friends' : 'private' })}
        />
      </Card>

      <Card title="Privacy zones">
        <Text style={text.bodyMuted}>
          A shared map always hides the first and last 200 m of a run. Add places like home or work,
          and runs that start or end there hide everything inside them too.
        </Text>
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push('/run/privacy-zones')}
          accessibilityRole="button"
        >
          <Text style={text.body}>
            {zoneCount === 0 ? 'Add a privacy zone' : zoneCount === 1 ? '1 privacy zone' : `${zoneCount} privacy zones`}
          </Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

function Row({
  label,
  caption,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  caption: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={[text.body, disabled && styles.dim]}>{label}</Text>
        <Text style={text.caption}>{caption}</Text>
      </View>
      <Switch value={value && !disabled} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
  dim: { color: colors.textFaint },
  flex: { flex: 1 },
});

import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Screen } from '@/components';
import {
  DEFAULT_RUN_PREFERENCES,
  usePrivacyZones,
  useRunPreferences,
  useUpdateRunPreferences,
  type RunPreferences,
} from '@/data/runs';
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

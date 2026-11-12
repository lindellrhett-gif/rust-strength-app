import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../Button';
import { Field } from '../Field';
import { NumberStepper } from '../NumberStepper';
import { ProCard } from '../ProCard';
import { RestAlertToggle } from '../RestAlertToggle';
import { SettingRow } from '../SettingRow';
import { SettingsSheet } from '../SettingsSheet';
import { useUpdateProfile } from '@/data/profile';
import { useProStatus } from '@/data/subscription';
import { EQUIPMENT_OPTIONS } from '@/domain/generator';
import { parseInlineNumber } from '@/domain/inlineEdit';
import { REST_PRESETS, clampRest, restLabel } from '@/domain/restTimer';
import type { EquipmentKind, Profile } from '@/lib/database.types';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const couldNotSave = (e: unknown) =>
  Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');

/** Choosing a username, opened from Profile. */
export function UsernameRow({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const value = handle ?? profile.username;
  const changed = handle != null && handle !== profile.username && handle.length >= 3;

  const close = () => {
    setHandle(null);
    setOpen(false);
  };

  const save = () =>
    update.mutate(
      { username: value, username_chosen: true },
      {
        onSuccess: close,
        onError: (e) =>
          Alert.alert(
            'Could not save',
            e instanceof Error && e.message.includes('duplicate')
              ? 'That username is taken.'
              : 'Please try a different username.',
          ),
      },
    );

  return (
    <>
      <SettingRow
        label="Username"
        value={profile.username_chosen ? `@${profile.username}` : 'Choose one'}
        onPress={() => setOpen(true)}
      />
      <SettingsSheet visible={open} title="Username" onClose={close} closeLabel="Cancel">
        <Field
          label="Username"
          value={value}
          onChangeText={(v: string) => setHandle(v.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        <Text style={text.caption}>
          Letters, numbers and underscores. Anyone searching can see this, so avoid your real name
          or email if you would rather stay anonymous.
        </Text>
        {changed ? <Button label="Save username" onPress={save} loading={update.isPending} /> : null}
      </SettingsSheet>
    </>
  );
}

/** The equipment preselected when generating a workout. */
export function EquipmentRow({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const equipment = profile.equipment ?? [];

  const toggle = (kind: EquipmentKind) =>
    update.mutate(
      { equipment: equipment.includes(kind) ? equipment.filter((e) => e !== kind) : [...equipment, kind] },
      { onError: couldNotSave },
    );

  return (
    <>
      <SettingRow
        label="Usual equipment"
        value={equipment.length > 0 ? String(equipment.length) : 'None'}
        onPress={() => setOpen(true)}
      />
      <SettingsSheet visible={open} title="Usual equipment" onClose={() => setOpen(false)}>
        <Text style={text.caption}>Preselected when you generate a workout.</Text>
        <View style={styles.chips}>
          {EQUIPMENT_OPTIONS.map((kind) => {
            const on = equipment.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => toggle(kind)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{kind}</Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsSheet>
    </>
  );
}

/** How long the rest timer runs, and whether it starts and alerts on its own. */
export function RestTimerRow({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const seconds = draft ?? profile.rest_seconds;

  const close = () => {
    if (seconds !== profile.rest_seconds) {
      update.mutate({ rest_seconds: clampRest(seconds) }, { onError: couldNotSave });
    }
    setDraft(null);
    setOpen(false);
  };

  return (
    <>
      <SettingRow
        label="Rest timer"
        value={`${restLabel(profile.rest_seconds)}${profile.rest_auto ? ' · auto' : ''}`}
        onPress={() => {
          setDraft(null);
          setOpen(true);
        }}
      />
      <SettingsSheet visible={open} title="Rest timer" onClose={close}>
        <View style={styles.chips}>
          {REST_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setDraft(preset)}
              style={[styles.chip, seconds === preset && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: seconds === preset }}
            >
              <Text style={[styles.chipText, seconds === preset && styles.chipTextOn]}>
                {restLabel(preset)}
              </Text>
            </Pressable>
          ))}
        </View>
        <NumberStepper
          label="Rest (seconds)"
          value={seconds}
          // The field can report its last value as the sheet slides away.
          onChange={(v) => {
            if (open) setDraft(clampRest(v));
          }}
          // Done can be tapped with the keyboard still up, before the field
          // reports. An empty field means no change, as it does on blur.
          onTyping={(typed) => setDraft(parseInlineNumber(typed, { min: 5, max: 3600 }))}
          step={15}
          min={5}
          max={3600}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={text.body}>Start automatically</Text>
            <Text style={text.caption}>When a working set is saved.</Text>
          </View>
          <Switch
            value={profile.rest_auto}
            onValueChange={(on) => update.mutate({ rest_auto: on }, { onError: couldNotSave })}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Start automatically"
          />
        </View>
        <RestAlertToggle />
      </SettingsSheet>
    </>
  );
}

/** Rust Strength Pro: the row and the sheet holding its status and plans. */
export function ProRow() {
  const status = useProStatus();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingRow
        label="Rust Strength Pro"
        value={status.data?.active ? 'Active' : 'See plans'}
        onPress={() => setOpen(true)}
      />
      <SettingsSheet visible={open} title="Rust Strength Pro" onClose={() => setOpen(false)}>
        <ProCard />
      </SettingsSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextOn: { color: colors.onPrimary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
});

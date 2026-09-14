import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { AlertPermission } from '@/domain/restAlert';
import {
  getAlertPermission,
  requestAlertPermission,
  setRestAlertEnabled,
  useRestAlertEnabled,
} from '@/lib/restNotifications';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/**
 * The opt-in for the "rest over" notification.
 *
 * Permission is asked for here, when the user switches it on, and never on
 * launch: iOS shows its prompt once, and a prompt with no context is the one
 * people refuse. If they have already refused, the row says so and offers a
 * way to Settings instead of a switch that silently does nothing.
 */
export function RestAlertToggle() {
  const enabled = useRestAlertEnabled();
  const [permission, setPermission] = useState<AlertPermission | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-check whenever the app comes back, since the likeliest reason to leave
  // is to change this very setting in iOS Settings.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      getAlertPermission()
        .then((next) => {
          if (!cancelled) setPermission(next);
        })
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const blocked = permission === 'blocked';
  const on = enabled && !blocked;

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const toggle = async (next: boolean) => {
    if (!next) {
      setRestAlertEnabled(false);
      return;
    }
    setBusy(true);
    try {
      const answer = await requestAlertPermission();
      setPermission(answer);
      if (answer === 'granted') {
        setRestAlertEnabled(true);
      } else {
        Alert.alert(
          'Notifications are off',
          'To get an alert when your rest is over, allow notifications for Rust Strength in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ],
        );
      }
    } catch {
      Alert.alert('Could not turn this on', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.label}>
          <Text style={text.body}>Alert when rest is over</Text>
          <Text style={text.caption}>
            A notification when the timer ends, so you hear it with the phone locked or in another
            app. It is set on your phone and nothing is sent anywhere.
          </Text>
        </View>
        <Switch
          value={on}
          disabled={busy}
          onValueChange={(next) => void toggle(next)}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Alert when rest is over"
        />
      </View>
      {enabled && blocked ? (
        <Pressable onPress={openSettings} accessibilityRole="link">
          <Text style={styles.warning}>
            Notifications are turned off for Rust Strength. Tap to open Settings.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: { flex: 1, gap: 2 },
  warning: { ...text.caption, color: colors.warning },
});

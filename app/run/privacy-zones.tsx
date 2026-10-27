import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle } from 'react-native-maps';

import { Button, Card, Field, LoadingView, NumberStepper, Screen } from '@/components';
import { useAddPrivacyZone, usePrivacyZones, useRemovePrivacyZone, type PrivacyZone } from '@/data/runs';
import { regionAround } from '@/domain/running/display';
import type { LatLon } from '@/domain/running/geo';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** The database allows ten zones per person. */
const MAX_ZONES = 10;
const MIN_RADIUS_M = 200;
const MAX_RADIUS_M = 1000;
const FEET_PER_METER = 3.28084;

const describeRadius = (m: number) =>
  `${m.toLocaleString('en-US')} m (${Math.round((m * FEET_PER_METER) / 10) * 10} ft)`;

export default function PrivacyZonesScreen() {
  const zones = usePrivacyZones();
  const add = useAddPrivacyZone();
  const remove = useRemovePrivacyZone();
  const map = useRef<MapView>(null);

  const [here, setHere] = useState<LatLon | null>(null);
  const [located, setLocated] = useState(false);
  const [draft, setDraft] = useState<LatLon | null>(null);
  const [label, setLabel] = useState('');
  const [radiusM, setRadiusM] = useState(400);

  // Where to open the map: your position if location is allowed.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.granted) {
          const last = await Location.getLastKnownPositionAsync();
          if (alive && last) setHere({ lat: last.coords.latitude, lon: last.coords.longitude });
        }
      } finally {
        if (alive) setLocated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const placeAtMyLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location is off', 'Long-press the map where you want the zone instead.');
      return;
    }
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const point = { lat: now.coords.latitude, lon: now.coords.longitude };
    setDraft(point);
    map.current?.animateCamera({ center: { latitude: point.lat, longitude: point.lon } }, { duration: 400 });
  };

  const save = async () => {
    if (!draft) return;
    try {
      await add.mutateAsync({ lat: draft.lat, lon: draft.lon, radiusM, label: label.trim() || null });
      setDraft(null);
      setLabel('');
    } catch (e) {
      Alert.alert('Could not add the zone', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const confirmRemove = (zone: PrivacyZone, name: string) =>
    Alert.alert(`Remove ${name}?`, 'Shared maps will no longer hide the start and end of runs there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(zone.id, {
            onError: (e) => Alert.alert('Could not remove', e instanceof Error ? e.message : 'Please try again.'),
          }),
      },
    ]);

  if (zones.isPending || !located) return <LoadingView label="Loading your zones…" />;

  const list = zones.data ?? [];
  const centre = here ?? (list[0] ? { lat: list[0].lat, lon: list[0].lon } : null);
  const full = list.length >= MAX_ZONES;

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Text style={text.bodyMuted}>
        When you share a run’s map, any part of the start or end inside a zone is hidden from
        friends. Your zones are never shown to anyone.
      </Text>

      <MapView
        ref={map}
        style={styles.map}
        initialRegion={centre ? regionAround(centre, 3000) : undefined}
        userInterfaceStyle="dark"
        showsUserLocation
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        onLongPress={(e) => {
          if (full) return;
          const c = e.nativeEvent.coordinate;
          setDraft({ lat: c.latitude, lon: c.longitude });
        }}
        accessible
        accessibilityLabel={`Map of your ${list.length} privacy zones. Long-press to place a new one.`}
      >
        {list.map((z) => (
          <Circle
            key={z.id}
            center={{ latitude: z.lat, longitude: z.lon }}
            radius={z.radiusM}
            strokeColor={colors.primary}
            fillColor="rgba(79, 140, 255, 0.18)"
          />
        ))}
        {draft ? (
          <Circle
            center={{ latitude: draft.lat, longitude: draft.lon }}
            radius={radiusM}
            strokeColor={colors.warning}
            fillColor="rgba(245, 177, 76, 0.2)"
          />
        ) : null}
      </MapView>

      {full ? (
        <Text style={text.caption}>You have the most zones allowed ({MAX_ZONES}). Remove one to add another.</Text>
      ) : draft ? (
        <Card title="New zone">
          <Field label="Name" value={label} onChangeText={setLabel} placeholder="Home, work…" maxLength={40} />
          <NumberStepper
            label="Radius (m)"
            value={radiusM}
            onChange={(v) => setRadiusM(Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, Math.round(v / 50) * 50)))}
            step={100}
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            suffix="m"
          />
          <Text style={text.caption}>Hides everything within {describeRadius(radiusM)} of the centre.</Text>
          <View style={styles.buttons}>
            <Button label="Save zone" onPress={() => void save()} loading={add.isPending} style={styles.flex} />
            <Button label="Cancel" variant="ghost" onPress={() => setDraft(null)} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <View style={styles.buttons}>
          <Button label="Use my location" variant="secondary" onPress={() => void placeAtMyLocation()} style={styles.flex} />
        </View>
      )}
      {!full && !draft ? <Text style={text.caption}>Or long-press the map to place a zone anywhere.</Text> : null}

      {list.length > 0 ? (
        <Card title="Your zones">
          {list.map((z, i) => {
            const name = z.label ?? `Zone ${i + 1}`;
            return (
              <View key={z.id} style={styles.zoneRow}>
                <View style={styles.flex}>
                  <Text style={text.body}>{name}</Text>
                  <Text style={text.caption}>{describeRadius(z.radiusM)}</Text>
                </View>
                <Pressable onPress={() => confirmRemove(z, name)} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} hitSlop={8}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  map: { height: 300, borderRadius: radius.lg, overflow: 'hidden' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  remove: { color: colors.danger, fontWeight: '600' },
  flex: { flex: 1 },
});

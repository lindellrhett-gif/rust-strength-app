import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { regionAround, regionForPoints } from '@/domain/running/display';
import type { LatLon } from '@/domain/running/geo';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface RunMapProps {
  /** The route, one line per unbroken stretch. */
  segments: LatLon[][];
  /** Parts of the route drawn faded, like the bits a trim would cut off. */
  faded?: LatLon[][];
  /** Where the runner is now. The map opens here, and follows it with `follow`. */
  position?: LatLon | null;
  /** Keep the map centred on `position` as it moves (while recording). */
  follow?: boolean;
  /** Show the blue dot for where you are now. */
  showsUser?: boolean;
  /** Open zoomed to the whole route (summary screens). */
  fitToRoute?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const toLatLng = (p: LatLon) => ({ latitude: p.lat, longitude: p.lon });

/**
 * A route on Apple Maps (MapKit), in the app's dark style. Purely visual:
 * VoiceOver reads the label passed in, which should say what the map shows.
 *
 * MapKit starts wherever it is first told to, and left to itself that is the
 * whole world. So the map only appears once there is somewhere to put it: the
 * route, or the runner's position, zoomed to a few blocks. Until then it shows
 * a placeholder.
 */
export function RunMap({
  segments,
  faded = [],
  position = null,
  follow = false,
  showsUser = false,
  fitToRoute = false,
  style,
  accessibilityLabel = 'Map of your route',
}: RunMapProps) {
  const ref = useRef<MapView>(null);
  const all = [...segments.flat(), ...faded.flat()];
  const region = fitToRoute ? regionForPoints(all) : position ? regionAround(position) : null;

  const lat = position?.lat;
  const lon = position?.lon;
  useEffect(() => {
    if (!follow || lat == null || lon == null) return;
    // Only the centre moves, so a pinch to zoom out sticks.
    ref.current?.animateCamera({ center: { latitude: lat, longitude: lon } }, { duration: 500 });
  }, [follow, lat, lon]);

  if (!region) {
    return (
      <View style={[styles.map, styles.placeholder, style]} accessible accessibilityLabel="Finding your location">
        <Text style={text.bodyMuted}>Finding your location…</Text>
      </View>
    );
  }

  const fit = () => {
    if (!fitToRoute || all.length < 2) return;
    ref.current?.fitToCoordinates(all.map(toLatLng), {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  };

  return (
    <MapView
      ref={ref}
      style={[styles.map, style]}
      initialRegion={region}
      userInterfaceStyle="dark"
      showsUserLocation={showsUser}
      showsPointsOfInterests={false}
      showsCompass={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      onMapReady={fit}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {faded.map((seg, i) => (
        <Polyline
          key={`faded-${i}`}
          coordinates={seg.map(toLatLng)}
          strokeColor={colors.textFaint}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
      ))}
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          coordinates={seg.map(toLatLng)}
          strokeColor={colors.primary}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: 'hidden' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

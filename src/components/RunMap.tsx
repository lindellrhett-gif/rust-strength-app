import { useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import type { LatLon } from '@/domain/running/geo';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/typography';

interface RunMapProps {
  /** The route, one line per unbroken stretch. */
  segments: LatLon[][];
  /** Keep the map centred on the runner (while recording). */
  follow?: boolean;
  /** Show the blue dot for where you are now. */
  showsUser?: boolean;
  /** Zoom to fit the whole route once the map is ready (summary screens). */
  fitToRoute?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const toLatLng = (p: LatLon) => ({ latitude: p.lat, longitude: p.lon });

/**
 * A route on Apple Maps (MapKit), in the app's dark style. Purely visual:
 * VoiceOver reads the label passed in, which should say what the map shows.
 */
export function RunMap({
  segments,
  follow = false,
  showsUser = false,
  fitToRoute = false,
  style,
  accessibilityLabel = 'Map of your route',
}: RunMapProps) {
  const ref = useRef<MapView>(null);

  const fit = () => {
    if (!fitToRoute) return;
    const all = segments.flat().map(toLatLng);
    if (all.length < 2) return;
    ref.current?.fitToCoordinates(all, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  };

  return (
    <MapView
      ref={ref}
      style={[styles.map, style]}
      userInterfaceStyle="dark"
      showsUserLocation={showsUser}
      followsUserLocation={follow}
      showsPointsOfInterests={false}
      showsCompass={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      onMapReady={fit}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
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
});

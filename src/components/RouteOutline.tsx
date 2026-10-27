import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { outlinePath } from '@/domain/running/display';
import type { LatLon } from '@/domain/running/geo';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/typography';

const HEIGHT = 120;

/**
 * A shared run's shape, drawn as a line with no map behind it. Lighter than
 * a live map in a scrolling feed, and no map tiles are fetched for someone
 * else's route. The line has already been trimmed on the server.
 */
export function RouteOutline({ points }: { points: LatLon[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const path = width > 0 ? outlinePath(points, width, HEIGHT, 12) : null;
  return (
    <View
      style={styles.box}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Outline of the route"
    >
      {path ? (
        <Svg width={width} height={HEIGHT}>
          <Path d={path} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
});

import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { energyUnitLabel, formatEnergy } from '@/domain/nutrition/diary';
import { colors } from '@/theme/colors';

const PLOT_HEIGHT = 120;
const TOP = 18;
const AXIS_BAND = 20;

export interface CalorieBar {
  key: string;
  /** Under the bar: "M", "10/26". */
  label: string;
  /** Null for a day or week with nothing logged: no bar, not a zero. */
  kcal: number | null;
  goalKcal: number | null;
}

/**
 * Calories per day (or per week, as a daily average) as bars, with each
 * period's goal as a short line across its bar: goals can change mid-range,
 * so one line across the chart would be wrong for some bars. Over the goal
 * shows in the warning colour. VoiceOver reads a summary instead of every bar.
 */
export function CalorieBars({
  bars,
  unit,
  summary,
}: {
  bars: CalorieBar[];
  unit: 'kcal' | 'kj';
  /** What VoiceOver reads for the whole chart. */
  summary: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(1, ...bars.map((b) => Math.max(b.kcal ?? 0, b.goalKcal ?? 0)));
  const slot = width / Math.max(1, bars.length);
  const barW = Math.max(3, slot * 0.6);
  const y = (v: number) => TOP + PLOT_HEIGHT - (v / max) * PLOT_HEIGHT;
  const floor = TOP + PLOT_HEIGHT;
  // Label every bar when there's room, otherwise every few, always the last.
  const every = slot >= 30 ? 1 : slot >= 14 ? 3 : 7;
  const highest = Math.max(0, ...bars.map((b) => b.kcal ?? 0));

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary}>
      {width > 0 ? (
        <Svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND}>
          <Line x1={0} x2={width} y1={floor} y2={floor} stroke={colors.border} strokeWidth={1} />
          {bars.map((b, i) => {
            const x = i * slot + (slot - barW) / 2;
            const h = b.kcal == null ? 0 : Math.max(b.kcal > 0 ? 2 : 0, floor - y(b.kcal));
            const over = b.kcal != null && b.goalKcal != null && b.kcal > b.goalKcal;
            const isLast = i === bars.length - 1;
            const showLabel = (bars.length - 1 - i) % every === 0;
            return (
              <G key={b.key}>
                {h > 0 ? (
                  <Rect
                    x={x}
                    y={floor - h}
                    width={barW}
                    height={h}
                    rx={2}
                    fill={over ? colors.warning : colors.primary}
                    fillOpacity={isLast ? 1 : 0.6}
                  />
                ) : null}
                {b.goalKcal != null ? (
                  <Line
                    x1={x - 1}
                    x2={x + barW + 1}
                    y1={y(b.goalKcal)}
                    y2={y(b.goalKcal)}
                    stroke={colors.success}
                    strokeWidth={2}
                  />
                ) : null}
                {b.kcal != null && b.kcal > 0 && (isLast || b.kcal === highest) && slot >= 14 ? (
                  <SvgText x={x + barW / 2} y={floor - h - 4} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                    {formatEnergy(b.kcal, unit)}
                  </SvgText>
                ) : null}
                {showLabel ? (
                  <SvgText x={x + barW / 2} y={floor + 14} fontSize={10} fill={colors.textFaint} textAnchor="middle">
                    {b.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          <SvgText x={width} y={10} fontSize={10} fill={colors.textFaint} textAnchor="end">
            {energyUnitLabel(unit)}
          </SvgText>
        </Svg>
      ) : (
        <View style={{ height: TOP + PLOT_HEIGHT + AXIS_BAND }} />
      )}
    </View>
  );
}

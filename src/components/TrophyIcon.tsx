import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';

import { TIER_COLOR, type Tier, type TrophyGlyph } from '@/domain/achievements';
import { colors } from '@/theme/colors';

/**
 * Drawn trophy icons — no emoji, so every badge shares one visual language.
 *
 * Each icon is the same pointy-top hexagon medal, tinted by tier, with a
 * line-art glyph inside. Every glyph is authored on the same 24x24 grid with
 * the same stroke weight and round caps, which is what keeps a barbell, a semi
 * truck and a flame looking like members of one set.
 */

const BADGE = '22,1 40.2,11.5 40.2,32.5 22,43 3.8,32.5 3.8,11.5';

/** Glyph paths, all authored on a 24x24 grid, stroke-only. */
const GLYPHS: Record<TrophyGlyph, React.ReactNode> = {
  bench: (
    <>
      <Path d="M3 8 H21" />
      <Path d="M5 5 V11 M7 6 V10 M17 6 V10 M19 5 V11" />
      <Path d="M6 15 H18 M8 15 V19 M16 15 V19" />
    </>
  ),
  squat: (
    <>
      <Path d="M4 8 H20" />
      <Path d="M6 5.5 V10.5 M18 5.5 V10.5" />
      <Circle cx="12" cy="4" r="2" />
      <Path d="M12 9 V13" />
      <Path d="M12 13 L8 16.5 V21 M12 13 L16 16.5 V21" />
    </>
  ),
  deadlift: (
    <>
      <Path d="M3 18 H21" />
      <Path d="M6 15 V21 M18 15 V21" />
      <Path d="M12 14 V4" />
      <Path d="M9 7 L12 4 L15 7" />
    </>
  ),
  press: (
    <>
      <Path d="M3 4 H21" />
      <Path d="M6 1.5 V6.5 M18 1.5 V6.5" />
      <Path d="M8 5 L9.5 10 M16 5 L14.5 10" />
      <Circle cx="12" cy="11" r="2" />
      <Path d="M12 13 V20" />
    </>
  ),
  row: (
    <>
      <Path d="M4 7 L15 9" />
      <Circle cx="17.5" cy="9.5" r="2" />
      <Path d="M11 8.5 V13" />
      <Path d="M5 15 H17" />
      <Path d="M7 12.5 V17.5 M15 12.5 V17.5" />
    </>
  ),
  pullup: (
    <>
      <Path d="M3 3 H21" />
      <Path d="M9 3 V8 M15 3 V8" />
      <Circle cx="12" cy="9.5" r="2" />
      <Path d="M12 11.5 V17" />
      <Path d="M12 17 L9 21 M12 17 L15 21" />
    </>
  ),
  pushup: (
    <>
      <Path d="M2 20.5 H22" />
      <Path d="M4 16.5 L14.5 11" />
      <Circle cx="17.5" cy="9.5" r="2" />
      <Path d="M11 13 V20.5" />
      <Path d="M4 16.5 V20.5" />
    </>
  ),
  dip: (
    <>
      <Path d="M3 6 H9 M15 6 H21" />
      <Path d="M5 6 V10 M19 6 V10" />
      <Path d="M8 6 V11 M16 6 V11" />
      <Circle cx="12" cy="11.5" r="2" />
      <Path d="M12 13.5 V18" />
      <Path d="M12 18 L9.5 21 M12 18 L14.5 21" />
    </>
  ),
  truck: (
    <>
      <Path d="M2 7 H13 V17 H2 Z" />
      <Path d="M13 11 H16.5 L20 14.5 V17 H13" />
      <Circle cx="6" cy="19" r="1.8" />
      <Circle cx="16.5" cy="19" r="1.8" />
    </>
  ),
  flame: (
    <>
      <Path d="M12 21.5 C7.5 21.5 5 18 6.5 14 C7.6 11.2 9.2 10.6 9.6 8 C10 5.4 9 3 9 3 C13 4.8 15.2 8 15.2 10.6 C16.2 9.7 16.8 8.2 16.8 8.2 C18.8 11.2 19.2 13.6 18.2 16.4 C17.1 19.6 15 21.5 12 21.5 Z" />
      <Path d="M12 21.5 C10 21.5 9 20 9.4 18.2 C9.8 16.4 11.4 15.8 11.8 14 C13.4 15.4 14.6 16.8 14.6 18.4 C14.6 20.2 13.6 21.5 12 21.5 Z" />
    </>
  ),
  calendar: (
    <>
      <Path d="M3.5 5.5 H20.5 V20.5 H3.5 Z" />
      <Path d="M3.5 9.5 H20.5" />
      <Path d="M8 3 V6.5 M16 3 V6.5" />
      <Circle cx="8" cy="13.5" r="1" />
      <Circle cx="12" cy="13.5" r="1" />
      <Circle cx="16" cy="13.5" r="1" />
      <Circle cx="8" cy="17.5" r="1" />
      <Circle cx="12" cy="17.5" r="1" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 6.5 V12 L15.8 14.2" />
    </>
  ),
  body: (
    <>
      <Circle cx="12" cy="4.5" r="2.5" />
      <Path d="M12 7 V14" />
      <Path d="M6 10 H18" />
      <Path d="M12 14 L8 21 M12 14 L16 21" />
    </>
  ),
  shoe: (
    <>
      <Path d="M3 16 H16 L20 13 L21 16 V19 H3 Z" />
      <Path d="M3 16 V10 H7 L10 13 H13" />
      <Path d="M7 10 V13" />
    </>
  ),
  heart: (
    <>
      <Path d="M12 20 C5 15.5 3 11.5 4.5 8.5 A4 4 0 0 1 12 8 A4 4 0 0 1 19.5 8.5 C21 11.5 19 15.5 12 20 Z" />
      <Path d="M6 12 H9.5 L11 9.5 L13 14.5 L14.5 12 H18" />
    </>
  ),
  stack: (
    <>
      <Path d="M5 4.5 H19 V8 H5 Z" />
      <Path d="M5 10.5 H19 V14 H5 Z" />
      <Path d="M5 16.5 H19 V20 H5 Z" />
    </>
  ),
  arm: (
    <>
      <Path d="M4 18 V12 A4 4 0 0 1 8 8 H12" />
      <Path d="M12 8 C16 8 18.5 10 19.5 13.5 C20.2 16 19 18 16.5 18 H4" />
      <Path d="M12 8 V5 H7.5" />
    </>
  ),
  plate: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3.5 V6.5 M12 17.5 V20.5 M3.5 12 H6.5 M17.5 12 H20.5" />
    </>
  ),
  clap: (
    <>
      <Path d="M9 20 C6 18.5 4.5 16 4.5 13 V8.5 A1.5 1.5 0 0 1 7.5 8.5 V12" />
      <Path d="M7.5 12 V6 A1.5 1.5 0 0 1 10.5 6 V11.5" />
      <Path d="M10.5 11.5 V6.5 A1.5 1.5 0 0 1 13.5 6.5 V12" />
      <Path d="M13.5 12 V8.5 A1.5 1.5 0 0 1 16.5 8.5 V14 C16.5 17.5 14 20 10.5 20 Z" />
      <Path d="M18 4 L20 2 M19.5 8 H22" />
    </>
  ),
  star: (
    <>
      <Path d="M12 3 L14.6 9 L21 9.7 L16.3 14 L17.6 20.3 L12 17.1 L6.4 20.3 L7.7 14 L3 9.7 L9.4 9 Z" />
    </>
  ),
  flask: (
    <>
      <Path d="M9.5 3 V9.5 L4.5 18 A2 2 0 0 0 6.3 21 H17.7 A2 2 0 0 0 19.5 18 L14.5 9.5 V3" />
      <Path d="M8 3 H16" />
      <Path d="M7 15 H17" />
      <Circle cx="10.5" cy="17.5" r="1" />
      <Circle cx="14" cy="18.5" r="0.8" />
    </>
  ),
  crown: (
    <>
      <Path d="M3.5 17.5 L5 7 L9.5 11 L12 4.5 L14.5 11 L19 7 L20.5 17.5 Z" />
      <Path d="M4.5 20.5 H19.5" />
    </>
  ),
  bolt: (
    <>
      <Path d="M13.5 2.5 L5.5 13.5 H11 L10 21.5 L18.5 10.5 H13 Z" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 2.5 L20 5.5 V12 C20 16.5 16.6 20 12 21.5 C7.4 20 4 16.5 4 12 V5.5 Z" />
      <Path d="M8.5 12 L11 14.5 L15.5 9.5" />
    </>
  ),
};

interface TrophyIconProps {
  glyph: TrophyGlyph;
  /** null renders the locked, un-tinted state. */
  tier: Tier | null;
  size?: number;
}

export function TrophyIcon({ glyph, tier, size = 44 }: TrophyIconProps) {
  const tint = tier ? TIER_COLOR[tier] : colors.textFaint;
  const locked = tier === null;

  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      {/* Medal plate — same silhouette for every trophy in the set. */}
      <Polygon
        points={BADGE}
        fill={locked ? colors.surface : `${tint}22`}
        stroke={tint}
        strokeWidth={locked ? 1.4 : 2}
        strokeLinejoin="round"
        opacity={locked ? 0.5 : 1}
      />
      {/* Inner bevel, so higher tiers read as more ornate than Wood. */}
      {!locked ? (
        <Polygon
          points={BADGE}
          fill="none"
          stroke={tint}
          strokeWidth={0.8}
          strokeLinejoin="round"
          opacity={0.45}
          transform="translate(22,22) scale(0.82) translate(-22,-22)"
        />
      ) : null}

      <G
        transform="translate(10,10)"
        stroke={tint}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={locked ? 0.55 : 1}
      >
        {GLYPHS[glyph]}
      </G>
    </Svg>
  );
}

/**
 * The same glyph without the medal around it, for places that need the icon on
 * its own — reaction buttons, inline labels. Keeps the one drawing vocabulary
 * so a flame in the feed matches the flame on the streak trophy.
 */
export function GlyphIcon({
  glyph,
  color,
  size = 18,
}: {
  glyph: TrophyGlyph;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {GLYPHS[glyph]}
      </G>
    </Svg>
  );
}

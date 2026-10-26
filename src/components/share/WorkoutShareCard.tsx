import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyFigure, type FigurePalette } from '../BodyChart';
import { TrophyIcon } from '../TrophyIcon';
import { CardFrame, CardText, StatRow, cardColors } from './cardParts';
import { buildBodyChart } from '@/domain/bodyChart';
import type { WorkoutCard } from '@/domain/shareCard';

/** The body figure in rust: darker for a few sets, brighter for more. */
const FIGURE: FigurePalette = {
  levels: { none: '#1E242C', light: '#6E3416', solid: cardColors.rust, heavy: cardColors.rustLight },
  outline: '#38404A',
  body: '#161B22',
};

/** The card shared after a workout: volume, records, muscles and exercises. */
export function WorkoutShareCard({ card, ref }: { card: WorkoutCard; ref?: Ref<View> }) {
  const regions = buildBodyChart(card.muscles);
  const recordCount = card.records.length + card.moreRecords;

  return (
    <CardFrame ref={ref} kicker="WORKOUT COMPLETE" topRight={card.subtitle}>
      <CardText style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {card.title}
      </CardText>

      <View>
        <View style={styles.volumeRow}>
          <CardText style={styles.volume} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {card.volume}
          </CardText>
          <CardText style={styles.volumeLabel}>{card.volumeLabel}</CardText>
        </View>
        {card.comparison ? <CardText style={styles.comparison}>{card.comparison}</CardText> : null}
      </View>

      <StatRow stats={card.stats} />

      {card.records.length > 0 ? (
        <View style={styles.records}>
          <CardText style={styles.recordsTitle}>
            {recordCount} PERSONAL RECORD{recordCount === 1 ? '' : 'S'}
          </CardText>
          {card.records.map((r) => (
            <View key={r.name} style={styles.recordRow}>
              <TrophyIcon glyph="stack" tier="gold" size={26} />
              <View style={styles.recordMain}>
                <CardText style={styles.recordName} numberOfLines={1}>
                  {r.name}
                </CardText>
                <CardText style={styles.recordDetail} numberOfLines={1}>
                  {r.detail}
                </CardText>
              </View>
              <CardText style={styles.recordValue}>{r.value}</CardText>
            </View>
          ))}
          {card.moreRecords > 0 ? <CardText style={styles.more}>+{card.moreRecords} more</CardText> : null}
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.figureColumn}>
          <View style={styles.figures}>
            <BodyFigure regions={regions} side="front" width={54} palette={FIGURE} label={false} />
            <BodyFigure regions={regions} side="back" width={54} palette={FIGURE} label={false} />
          </View>
          {card.muscleLine ? (
            <CardText style={styles.muscleLine} numberOfLines={2}>
              {card.muscleLine}
            </CardText>
          ) : null}
        </View>
        <View style={styles.exercises}>
          {card.exercises.map((e, i) => (
            <View key={`${e.name}-${i}`} style={styles.exercise}>
              <CardText style={styles.exerciseName} numberOfLines={1}>
                {e.name}
              </CardText>
              <View style={styles.exerciseDetailRow}>
                <CardText style={styles.exerciseDetail} numberOfLines={1}>
                  {e.detail}
                </CardText>
                {e.isRecord ? <CardText style={styles.prTag}>PR</CardText> : null}
              </View>
            </View>
          ))}
          {card.moreExercises > 0 ? <CardText style={styles.more}>+{card.moreExercises} more</CardText> : null}
        </View>
      </View>
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  title: { color: cardColors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  volumeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  volume: {
    color: cardColors.text,
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  volumeLabel: { color: cardColors.muted, fontSize: 15, fontWeight: '700' },
  comparison: { color: cardColors.rustLight, fontSize: 13, fontWeight: '700', marginTop: -2 },
  records: {
    borderWidth: 1,
    borderColor: 'rgba(245,177,76,0.45)',
    backgroundColor: 'rgba(245,177,76,0.07)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  recordsTitle: { color: cardColors.gold, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordMain: { flex: 1, gap: 1 },
  recordName: { color: cardColors.text, fontSize: 13.5, fontWeight: '800' },
  recordDetail: { color: cardColors.muted, fontSize: 10.5, fontWeight: '500' },
  recordValue: { color: cardColors.gold, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bottom: { flex: 1, flexDirection: 'row', gap: 14, overflow: 'hidden' },
  figureColumn: { width: 112, gap: 6 },
  figures: { flexDirection: 'row', gap: 4 },
  muscleLine: { color: cardColors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  exercises: { flex: 1, gap: 7 },
  exercise: { gap: 1 },
  exerciseName: { color: cardColors.text, fontSize: 13, fontWeight: '800' },
  exerciseDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseDetail: { color: cardColors.muted, fontSize: 11, fontWeight: '500', flexShrink: 1, fontVariant: ['tabular-nums'] },
  prTag: {
    color: cardColors.ground,
    backgroundColor: cardColors.gold,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  more: { color: cardColors.faint, fontSize: 10.5, fontWeight: '700' },
});

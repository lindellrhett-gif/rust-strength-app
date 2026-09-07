import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays } from '@/domain/stats';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export interface MonthCalendarProps {
  /** Any date inside the month to render, as YYYY-MM-DD. */
  month: string;
  /** Dates with a completed workout. */
  workoutDates: Set<string>;
  /** Dates with a logged activity. */
  activityDates: Set<string>;
  /** Dates marked as a deliberate rest day. */
  restDates: Set<string>;
  /** Dates with a future session planned. */
  plannedDates: Set<string>;
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

/**
 * Monday-first month grid, drawn as an actual grid: every day is a bordered
 * square box, so the month reads as a wall calendar rather than a scatter of
 * circles. Built from plain date arithmetic to stay consistent with the app's
 * `YYYY-MM-DD` local-date handling.
 */
export function MonthCalendar({
  month,
  workoutDates,
  activityDates,
  restDates,
  plannedDates,
  selected,
  today,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const [y, m] = month.split('-').map(Number);
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 0; d < daysInMonth; d += 1) cells.push(addDays(first, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12} style={styles.nav}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={text.heading}>{title}</Text>
        <Pressable onPress={onNextMonth} hitSlop={12} style={styles.nav}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, i) => (
            <View key={`${d}-${i}`} style={styles.weekdayCell}>
              <Text style={styles.weekday}>{d}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={`w-${wi}`} style={styles.weekRow}>
            {week.map((date, di) => {
              if (date == null) {
                return <View key={`blank-${wi}-${di}`} style={[styles.cell, styles.cellEmpty]} />;
              }
              const trained = workoutDates.has(date);
              const active = activityDates.has(date);
              const rested = restDates.has(date);
              const planned = plannedDates.has(date);
              const isToday = date === today;
              const isSelected = date === selected;

              return (
                <Pressable
                  key={date}
                  onPress={() => onSelect(date)}
                  style={[
                    styles.cell,
                    trained && styles.cellTrained,
                    !trained && rested && styles.cellRested,
                    isToday && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      (trained || isSelected || isToday) && styles.cellTextStrong,
                      trained && styles.cellTextTrained,
                    ]}
                  >
                    {Number(date.slice(8, 10))}
                  </Text>

                  <View style={styles.dots}>
                    {active ? <View style={[styles.dot, styles.dotActivity]} /> : null}
                    {planned ? <View style={[styles.dot, styles.dotPlanned]} /> : null}
                    {rested && !trained ? <View style={[styles.dot, styles.dotRest]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Key color={colors.primary} label="lifted" filled />
        <Key color={colors.success} label="activity" />
        <Key color={colors.warning} label="planned" />
        <Key color={colors.textMuted} label="rest" />
      </View>
    </View>
  );
}

function Key({ color, label, filled }: { color: string; label: string; filled?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[filled ? styles.legendBox : styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  navText: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 24 },

  // The grid is one bordered block; cells share hairline borders so the month
  // reads as a table rather than as floating buttons.
  grid: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  weekRow: { flexDirection: 'row' },
  weekdayCell: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  weekday: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 3,
  },
  cellEmpty: { backgroundColor: colors.background },
  cellTrained: { backgroundColor: colors.primary },
  cellRested: { backgroundColor: colors.surfaceRaised },
  cellToday: { borderWidth: 1.5, borderColor: colors.textMuted },
  cellSelected: { borderWidth: 2, borderColor: colors.text },
  cellText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  cellTextStrong: { color: colors.text, fontWeight: '800' },
  cellTextTrained: { color: colors.onPrimary },

  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotActivity: { backgroundColor: colors.success },
  dotPlanned: { backgroundColor: colors.warning },
  dotRest: { backgroundColor: colors.textMuted },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendBox: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 11 },
});

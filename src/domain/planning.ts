/**
 * Planning sessions and rest days on the Calendar: for today or a day still to
 * come. A day that has passed can have a workout or activity logged on it,
 * but not a plan or a rest day (a rest day keeps a streak alive, so adding one
 * afterwards would rescue a streak that was really broken).
 *
 * Dates are local YYYY-MM-DD strings, which sort the same way as the days.
 */
export function canPlanOn(date: string, today: string): boolean {
  return date >= today;
}

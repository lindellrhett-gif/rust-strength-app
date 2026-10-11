/**
 * Planning sessions on the Calendar. A plan is for today or a day still to
 * come; a day that has passed can have a workout or activity logged on it,
 * or be marked as a rest day, but not be planned.
 *
 * Dates are local YYYY-MM-DD strings, which sort the same way as the days.
 */
export function canPlanOn(date: string, today: string): boolean {
  return date >= today;
}

import { useMemo } from 'react';

import { useActivityTotals } from './activities';
import { useGrantedBadges } from './badges';
import { useFriendships } from './friends';
import { useProfile } from './profile';
import { useRestDays } from './restDays';
import { useMyTrophyTotals } from './trophies';
import {
  bestE1rmMap,
  bestRepsMap,
  bestWeightMap,
  useAllTimeTotals,
  useExercisePRs,
  useWeeklyCoverage,
  useTrainedDates,
} from './stats';
import {
  evaluateAchievements,
  totalTiersEarned,
  type TieredAchievement,
} from '@/domain/achievements';
import { evaluateBadges, type EarnedBadge } from '@/domain/badges';
import { MUSCLE_GROUPS, bestStreak, currentStreak, weekStart } from '@/domain/stats';
import {
  computeXp,
  levelProgress,
  strengthScore,
  type LevelProgress,
  type XpBreakdown,
} from '@/domain/xp';
import { todayLocal } from '@/lib/dates';

export interface LevelSnapshot {
  xp: XpBreakdown;
  level: LevelProgress;
  badges: EarnedBadge[];
  achievements: TieredAchievement[];
  /** False while the underlying totals are still loading. */
  ready: boolean;
  /**
   * True once every number the trophies rest on has actually arrived, not
   * just stopped loading. Only then is it safe to act on which trophies are
   * held, like dropping a featured one that no longer is.
   */
  trophiesSettled: boolean;
}

/**
 * The signed-in user's XP, level, badges and trophies in one place.
 *
 * All of it is derived from totals the app already caches, so this hook adds no
 * network traffic beyond what the profile screen was fetching anyway — and it
 * means the level on the profile, the level-up on the summary screen and the
 * badges in the feed are all computed by exactly one piece of code.
 */
export function useMyLevel(): LevelSnapshot {
  const profile = useProfile();
  const totals = useAllTimeTotals();
  const dates = useTrainedDates();
  const prs = useExercisePRs();
  const activity = useActivityTotals();
  const restDays = useRestDays();
  const friendships = useFriendships();
  const granted = useGrantedBadges();
  const trophyTotals = useMyTrophyTotals();

  const today = todayLocal();
  const coverage = useWeeklyCoverage(weekStart(today));

  const restDates = useMemo(
    () => (restDays.data ?? []).map((r) => r.rest_date),
    [restDays.data],
  );

  const unit = profile.data?.unit ?? 'lb';
  const sharesSteps = profile.data?.share_steps === true;

  const friendCount = useMemo(
    () => (friendships.data ?? []).filter((e) => e.status === 'accepted').length,
    [friendships.data],
  );

  const achievements = useMemo(() => {
    const groupsThisWeek = MUSCLE_GROUPS.filter((g) => (coverage.data?.[g] ?? 0) > 0).length;
    return evaluateAchievements({
      totalWorkouts: totals.data?.totalWorkouts ?? 0,
      totalVolume: totals.data?.volume ?? 0,
      totalReps: totals.data?.totalReps ?? 0,
      totalSets: totals.data?.totalSets ?? 0,
      totalSeconds: totals.data?.totalSeconds ?? 0,
      currentStreak: currentStreak(dates.data ?? [], today, restDates),
      bestStreak: bestStreak(dates.data ?? [], restDates),
      groupsThisWeek,
      groupsTotal: MUSCLE_GROUPS.length,
      activitySeconds: activity.data?.totalSeconds ?? 0,
      activityCount: activity.data?.totalActivities ?? 0,
      activityKinds: activity.data?.distinctKinds ?? 0,
      bestWeightByExercise: bestWeightMap(prs.data),
      bestRepsByExercise: bestRepsMap(prs.data),
      unit,
      runDistanceM: trophyTotals.data?.runDistanceM ?? 0,
      stepsTotal: sharesSteps ? (trophyTotals.data?.stepsTotal ?? 0) : null,
      friendCount,
      reactionsReceived: trophyTotals.data?.reactionsReceived ?? 0,
    });
  }, [
    totals.data,
    dates.data,
    coverage.data,
    today,
    prs.data,
    unit,
    activity.data,
    restDates,
    trophyTotals.data,
    sharesSteps,
    friendCount,
  ]);

  const xp = useMemo(
    () =>
      computeXp({
        totalWorkouts: totals.data?.totalWorkouts ?? 0,
        totalSets: totals.data?.totalSets ?? 0,
        totalVolume: totals.data?.volume ?? 0,
        totalActivities: activity.data?.totalActivities ?? 0,
        bestStreak: bestStreak(dates.data ?? [], restDates),
        friendCount,
        trophyTiers: totalTiersEarned(achievements),
        strengthScore: strengthScore(bestE1rmMap(prs.data)),
        unit,
      }),
    [totals.data, activity.data, dates.data, restDates, friendCount, achievements, prs.data, unit],
  );

  const level = levelProgress(xp.total);
  const badges = useMemo(
    () => evaluateBadges(level.level, granted.data ?? []),
    [level.level, granted.data],
  );

  return {
    xp,
    level,
    badges,
    achievements,
    // Totals are what the level actually rests on. Reporting "ready" before
    // they land would flash level 1 and, on the summary screen, could fire a
    // bogus level-up.
    ready: !totals.isLoading && !prs.isLoading && !profile.isLoading && !trophyTotals.isLoading,
    trophiesSettled:
      totals.isSuccess &&
      prs.isSuccess &&
      profile.isSuccess &&
      trophyTotals.isSuccess &&
      friendships.isSuccess &&
      activity.isSuccess &&
      dates.data !== undefined,
  };
}

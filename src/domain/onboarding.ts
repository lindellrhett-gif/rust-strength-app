/**
 * The cards shown once, the first time someone signs in.
 *
 * Content lives here rather than in the component so it can be checked by
 * tests: no emoji (the app draws its own icons), nothing that reads as coaching
 * or a health claim, and short enough to actually be read on a phone.
 */

import type { TrophyGlyph } from './achievements';

export interface OnboardingCard {
  id: string;
  glyph: TrophyGlyph;
  title: string;
  body: string;
  /** One extra line in smaller type, where a card needs a caveat. */
  footnote?: string;
}

/** Longest a body may be before it stops being skimmable on a phone. */
export const MAX_BODY_LENGTH = 220;

export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    id: 'log',
    glyph: 'bench',
    title: 'Log a set, get the next one',
    body:
      'Enter the weight and reps you just did. Rust Strength estimates your one-rep max from that and suggests what to load for your next set.',
  },
  {
    id: 'rpe',
    glyph: 'bolt',
    title: 'Rate how hard it felt',
    body:
      'After each set, slide the RPE scale. 10 means you had nothing left; 8 means you could have done two more. That one number is what makes the next suggestion useful.',
  },
  {
    id: 'machines',
    glyph: 'plate',
    title: 'Tell it which machine',
    body:
      'Gyms label weight differently and stacks move in different steps. Pick the machine you used and every suggestion gets rounded to a weight that machine can actually be set to.',
  },
  {
    id: 'session',
    glyph: 'calendar',
    title: 'Presets, rest and rest days',
    body:
      'Save a session as a preset to start it pre-loaded next time. A rest timer runs between sets, and the calendar takes planned sessions and rest days.',
  },
  {
    id: 'progress',
    glyph: 'crown',
    title: 'Trophies, levels and friends',
    body:
      'Training earns XP and climbs nine trophy tiers. Add friends to see a feed of their sessions, and tap any personal record to chart it over time.',
    footnote:
      'Rust Strength is a training log, not medical or coaching advice. Warm up, use your judgement, and stop if something hurts.',
  },
];

export function cardCount(): number {
  return ONBOARDING_CARDS.length;
}

export function isLastCard(index: number): boolean {
  return index >= ONBOARDING_CARDS.length - 1;
}

/** Keeps the index inside the deck however the pager rounds a swipe. */
export function clampCardIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(ONBOARDING_CARDS.length - 1, Math.max(0, Math.round(index)));
}

/** Label for the primary button — "Next" until the end, then "Start lifting". */
export function primaryLabel(index: number): string {
  return isLastCard(index) ? 'Start lifting' : 'Next';
}

/**
 * Where the "seen it" flag is kept, per account.
 *
 * Keyed by user id so a second account on the same phone gets its own run
 * through the cards, rather than inheriting someone else's.
 */
export function onboardingKey(userId: string): string {
  return `onboarding-seen:${userId}`;
}

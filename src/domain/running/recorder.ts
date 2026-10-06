/**
 * The recording flow as a state machine: idle, a countdown, recording,
 * paused, finished. Pure, no I/O; the screen dispatches events and renders
 * whatever state comes back, and the same state is saved to disk so a run
 * survives the app being killed.
 *
 * Events that do not make sense in the current state are ignored rather than
 * thrown, so a double tap or a late timer can never corrupt a run.
 */

export const COUNTDOWN_SECONDS = 3;

export type RecorderStatus = 'idle' | 'countdown' | 'recording' | 'paused' | 'finished';

export interface RecorderState {
  status: RecorderStatus;
  /** When the countdown reaches zero, in epoch milliseconds. */
  countdownEndsAt: number | null;
  /** When recording began, after the countdown. */
  startedAt: number | null;
  finishedAt: number | null;
  /** When the current manual pause began. */
  pausedAt: number | null;
  /** Milliseconds spent in manual pauses that have ended. */
  pausedMs: number;
  /** Every manual pause that has ended, as [start, end] in epoch milliseconds. */
  pauses: [number, number][];
  /** Goes up by one on every resume; fixes carry it. */
  segment: number;
}

export type RecorderEvent =
  | { type: 'start'; now: number; countdownSeconds?: number }
  | { type: 'tick'; now: number }
  | { type: 'skipCountdown'; now: number }
  | { type: 'cancel' }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'finish'; now: number };

export const initialRecorder: RecorderState = {
  status: 'idle',
  countdownEndsAt: null,
  startedAt: null,
  finishedAt: null,
  pausedAt: null,
  pausedMs: 0,
  pauses: [],
  segment: 0,
};

export function reduceRecorder(state: RecorderState, event: RecorderEvent): RecorderState {
  switch (event.type) {
    case 'start': {
      if (state.status !== 'idle') return state;
      const seconds = Math.max(0, Math.floor(event.countdownSeconds ?? COUNTDOWN_SECONDS));
      if (seconds === 0) return { ...initialRecorder, status: 'recording', startedAt: event.now };
      return { ...initialRecorder, status: 'countdown', countdownEndsAt: event.now + seconds * 1000 };
    }
    case 'tick':
      if (state.status !== 'countdown' || state.countdownEndsAt == null) return state;
      if (event.now < state.countdownEndsAt) return state;
      return { ...state, status: 'recording', startedAt: state.countdownEndsAt, countdownEndsAt: null };
    case 'skipCountdown':
      if (state.status !== 'countdown') return state;
      return { ...state, status: 'recording', startedAt: event.now, countdownEndsAt: null };
    case 'cancel':
      return state.status === 'countdown' ? initialRecorder : state;
    case 'pause':
      if (state.status !== 'recording') return state;
      return { ...state, status: 'paused', pausedAt: event.now };
    case 'resume':
      if (state.status !== 'paused' || state.pausedAt == null) return state;
      return {
        ...state,
        status: 'recording',
        pausedMs: state.pausedMs + Math.max(0, event.now - state.pausedAt),
        pauses: [...state.pauses, [state.pausedAt, Math.max(state.pausedAt, event.now)]],
        pausedAt: null,
        segment: state.segment + 1,
      };
    case 'finish': {
      if (state.status !== 'recording' && state.status !== 'paused') return state;
      const pausedAt = state.status === 'paused' ? state.pausedAt : null;
      const extra = pausedAt != null ? event.now - pausedAt : 0;
      return {
        ...state,
        status: 'finished',
        finishedAt: event.now,
        pausedAt: null,
        pausedMs: state.pausedMs + Math.max(0, extra),
        pauses: pausedAt != null ? [...state.pauses, [pausedAt, Math.max(pausedAt, event.now)]] : state.pauses,
      };
    }
  }
}

/** True while new GPS fixes belong to the run. */
export function acceptsFixes(state: RecorderState): boolean {
  return state.status === 'recording';
}

/** Wall-clock milliseconds since recording began, pauses included. */
export function elapsedMs(state: RecorderState, now: number): number {
  if (state.startedAt == null) return 0;
  return Math.max(0, (state.finishedAt ?? now) - state.startedAt);
}

/** Milliseconds actually spent recording: elapsed minus manual pauses. */
export function recordingMs(state: RecorderState, now: number): number {
  const openPause = state.status === 'paused' && state.pausedAt != null ? now - state.pausedAt : 0;
  return Math.max(0, elapsedMs(state, now) - state.pausedMs - Math.max(0, openPause));
}

/** When the current stretch of recording began: the start, or the latest resume. */
export function segmentStartedAt(state: RecorderState): number | null {
  const last = state.pauses[state.pauses.length - 1];
  return last ? last[1] : state.startedAt;
}

/**
 * The spans of time actually spent recording, as [start, end] in epoch
 * milliseconds: from the start to the finish (or now), minus manual pauses.
 */
export function recordingIntervals(state: RecorderState, now: number): [number, number][] {
  if (state.startedAt == null) return [];
  const end =
    state.finishedAt ?? (state.status === 'paused' && state.pausedAt != null ? state.pausedAt : now);
  const spans: [number, number][] = [];
  let from = state.startedAt;
  for (const [pauseStart, pauseEnd] of state.pauses) {
    if (Math.min(pauseStart, end) > from) spans.push([from, Math.min(pauseStart, end)]);
    from = Math.max(from, pauseEnd);
  }
  if (end > from) spans.push([from, end]);
  return spans;
}

/** Whole seconds left on the countdown, for the 3, 2, 1. */
export function countdownRemaining(state: RecorderState, now: number): number {
  if (state.status !== 'countdown' || state.countdownEndsAt == null) return 0;
  return Math.max(0, Math.ceil((state.countdownEndsAt - now) / 1000));
}

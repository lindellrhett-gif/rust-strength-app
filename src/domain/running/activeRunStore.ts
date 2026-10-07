/**
 * The run being recorded, kept on disk so it survives the app being killed,
 * crashing, or the phone restarting mid-run.
 *
 * Fixes are stored in chunks of CHUNK_SIZE, so each new batch rewrites one
 * small chunk instead of the whole run. The meta record (recorder state and
 * how many fixes count) is written after the chunk, so a crash between the
 * two loses at most the newest batch and never corrupts what came before.
 *
 * Every operation runs through one queue, so the GPS task appending fixes and
 * the screen pausing the run can never interleave half-written state.
 *
 * Storage is passed in (AsyncStorage in the app, a Map in tests), so this file
 * has no React Native imports.
 */

import { initialRecorder, reduceRecorder, type RecorderState } from './recorder';
import type { GpsFix } from './types';
import type { RunDistanceUnit } from './units';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 200;
export const META_KEY = 'run:active:meta';
export const chunkKey = (n: number) => `run:active:chunk:${n}`;
const VERSION = 1;

export interface ActiveRunMeta {
  version: typeof VERSION;
  /** Also the activity id the run is saved under, so a retried save can't duplicate it. */
  runId: string;
  /**
   * Who recorded it. A run left on the phone is never offered to, or saved
   * under, anyone else who signs in. Null for runs from before this existed.
   */
  userId: string | null;
  recorder: RecorderState;
  unit: RunDistanceUnit;
  autoPause: boolean;
  /** Spoken updates every mile or kilometre. Missing on runs from before them: on. */
  audioCues?: boolean;
  bodyweightKg: number | null;
  mapVisibility: 'private' | 'friends';
  fixCount: number;
}

export interface ActiveRun {
  meta: ActiveRunMeta;
  fixes: GpsFix[];
}

export type NewRun = Omit<ActiveRunMeta, 'version' | 'fixCount'>;

/** A fix as it arrives, before the store stamps the recording segment on it. */
export type IncomingFix = Omit<GpsFix, 'seg'>;

export interface RunStore {
  /** Reads the run from disk the first time, then answers from memory. */
  load(): Promise<ActiveRun | null>;
  /** What is in memory right now; null before load() or with no run. */
  current(): ActiveRun | null;
  subscribe(listener: (run: ActiveRun | null) => void): () => void;
  start(run: NewRun): Promise<void>;
  setRecorder(recorder: RecorderState): Promise<void>;
  /** Adds fixes taken while recording; returns how many were kept. */
  append(fixes: readonly IncomingFix[]): Promise<number>;
  /** Removes the run. With an id, only if it is still that run. */
  clear(runId?: string): Promise<void>;
}

export function createRunStore(storage: KeyValueStorage): RunStore {
  let state: ActiveRun | null = null;
  let loaded = false;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(run: ActiveRun | null) => void>();

  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };
  const emit = () => listeners.forEach((l) => l(state));

  async function readDisk(): Promise<void> {
    if (loaded) return;
    loaded = true;
    const raw = await storage.getItem(META_KEY);
    if (!raw) return;
    try {
      const meta = JSON.parse(raw) as ActiveRunMeta;
      if (meta?.version !== VERSION || typeof meta.runId !== 'string') return;
      const chunks = Math.ceil(meta.fixCount / CHUNK_SIZE);
      const fixes: GpsFix[] = [];
      for (let c = 0; c < chunks; c += 1) {
        const part = await storage.getItem(chunkKey(c));
        if (part) fixes.push(...(JSON.parse(part) as GpsFix[]));
      }
      // Anything past fixCount is from a batch whose meta never got written.
      // Fields added to the recorder since the run began get their defaults.
      state = {
        meta: {
          ...meta,
          userId: meta.userId ?? null,
          recorder: { ...initialRecorder, ...meta.recorder },
          fixCount: Math.min(meta.fixCount, fixes.length),
        },
        fixes: fixes.slice(0, meta.fixCount),
      };
    } catch {
      // A damaged record is worth less than a clean start.
      state = null;
    }
  }

  async function writeMeta(): Promise<void> {
    if (state) await storage.setItem(META_KEY, JSON.stringify(state.meta));
  }

  async function wipeDisk(fixCount: number): Promise<void> {
    await storage.removeItem(META_KEY);
    const chunks = Math.max(1, Math.ceil(fixCount / CHUNK_SIZE));
    for (let c = 0; c < chunks; c += 1) await storage.removeItem(chunkKey(c));
  }

  return {
    load: () =>
      serial(async () => {
        const first = !loaded;
        await readDisk();
        if (first) emit();
        return state;
      }),

    current: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start: (run) =>
      serial(async () => {
        await readDisk();
        await wipeDisk(state?.meta.fixCount ?? 0);
        state = { meta: { ...run, version: VERSION, fixCount: 0 }, fixes: [] };
        await writeMeta();
        emit();
      }),

    setRecorder: (recorder) =>
      serial(async () => {
        await readDisk();
        if (!state) return;
        state = { ...state, meta: { ...state.meta, recorder } };
        await writeMeta();
        emit();
      }),

    append: (incoming) =>
      serial(async () => {
        await readDisk();
        if (!state) return 0;
        let rec = state.meta.recorder;
        // The countdown ends on time even with the screen locked, when no
        // timer on screen is running: the first fix after it starts the run.
        if (rec.status === 'countdown') {
          let latest = -Infinity;
          for (const f of incoming) if (Number.isFinite(f.t) && f.t > latest) latest = f.t;
          rec = reduceRecorder(rec, { type: 'tick', now: latest });
        }
        if (rec.status !== 'recording' || rec.startedAt == null) return 0;
        const startedAt = rec.startedAt;
        const accepted: GpsFix[] = incoming
          .filter((f) => Number.isFinite(f.t) && f.t >= startedAt)
          .map((f) => ({ ...f, seg: rec.segment }));
        if (accepted.length === 0) return 0;

        const before = state.fixes.length;
        const fixes = [...state.fixes, ...accepted];
        const first = Math.floor(before / CHUNK_SIZE);
        const last = Math.floor((fixes.length - 1) / CHUNK_SIZE);
        for (let c = first; c <= last; c += 1) {
          await storage.setItem(chunkKey(c), JSON.stringify(fixes.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE)));
        }
        state = { meta: { ...state.meta, recorder: rec, fixCount: fixes.length }, fixes };
        await writeMeta();
        emit();
        return accepted.length;
      }),

    clear: (runId) =>
      serial(async () => {
        await readDisk();
        if (runId && state && state.meta.runId !== runId) return;
        await wipeDisk(state?.meta.fixCount ?? 0);
        state = null;
        emit();
      }),
  };
}

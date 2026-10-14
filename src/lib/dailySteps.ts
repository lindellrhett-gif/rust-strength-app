/**
 * Uploads the last week's daily step totals while sharing daily steps is on
 * (Profile > Sharing with friends). The phone's motion chip already keeps
 * them, so this only reads seven numbers and sends them; nothing runs in the
 * background. See src/domain/dailySteps.ts.
 */
import { stepDays, stepsPayload } from '@/domain/dailySteps';

import { supabase } from './supabase';
import { getStepAccess, stepsDuring } from './steps';

/** Coming back to the app more often than this doesn't upload again. */
const MIN_GAP_MS = 10 * 60_000;

let lastSync = 0;
let running: Promise<boolean> | null = null;

/** True when totals were uploaded. Quietly does nothing without step access. */
export function syncDailySteps(opts: { force?: boolean } = {}): Promise<boolean> {
  const now = Date.now();
  if (running) return running;
  if (!opts.force && now - lastSync < MIN_GAP_MS) return Promise.resolve(false);
  running = (async () => {
    try {
      if ((await getStepAccess()) !== 'granted') return false;
      const days = stepDays(new Date(now));
      const counts = await Promise.all(days.map((d) => stepsDuring([[d.start, d.end]])));
      const payload = stepsPayload(days, counts);
      if (payload.length === 0) return false;
      const { error } = await supabase.rpc('rpc_sync_daily_steps', { p_days: payload });
      if (error) return false;
      lastSync = now;
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

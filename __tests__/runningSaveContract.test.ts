/**
 * The contract between the app and rpc_save_run. A real recorded run (the
 * simulated 5K) is turned into save arguments here and compared with the
 * fixture that `npm run test:db` feeds to the database, so the app can't
 * drift from what the database accepts without one of the two suites failing.
 *
 * After an intended change to the save format, regenerate the fixture:
 *   UPDATE_FIXTURES=1 npx jest runningSaveContract
 */
import * as fs from 'fs';
import * as path from 'path';

import { parseGpx } from '../src/domain/running/gpx';
import { initialRecorder } from '../src/domain/running/recorder';
import { buildSaveRunInput } from '../src/domain/running/save';
import { summarizeRun } from '../src/domain/running/summarize';

const GPX = path.join(__dirname, 'fixtures', 'gpx', 'steady-5k.gpx');
const FIXTURE = path.join(__dirname, '..', 'supabase', 'tests', 'fixtures', 'save-run-5k.json');

function buildInput() {
  const fixes = parseGpx(fs.readFileSync(GPX, 'utf8'));
  const ts = fixes.map((f) => f.t);
  const recorder = { ...initialRecorder, status: 'finished' as const, startedAt: Math.min(...ts), finishedAt: Math.max(...ts) };
  const summary = summarizeRun(fixes, recorder, { autoPause: true, unit: 'km', bodyweightKg: 75 });
  const input = buildSaveRunInput(summary, {
    runId: '6f9c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
    startedAt: recorder.startedAt,
    unit: 'km',
    mapVisibility: 'private',
    steps: 4980,
  });
  // The default name depends on the machine's time zone; naming has its own tests.
  return { ...input, p_name: 'Morning run' };
}

it('the database fixture matches what the app sends', () => {
  const input = buildInput();
  if (process.env.UPDATE_FIXTURES) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(input, null, 2) + '\n');
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  expect(fixture).toEqual(JSON.parse(JSON.stringify(input)));
});

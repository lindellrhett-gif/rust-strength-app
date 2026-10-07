/**
 * The contract between the app and rpc_save_run. A real recorded run (the
 * simulated 5K) is turned into save arguments here and compared with the
 * fixture that `npm run test:db` feeds to the database, so the app can't
 * drift from what the database accepts without one of the two suites failing.
 *
 * The same goes for trimming a saved run (crop-run-5k.json, fed to
 * rpc_crop_run by supabase/tests/run-edit.test.mjs).
 *
 * After an intended change to either format, regenerate the fixtures:
 *   UPDATE_FIXTURES=1 npx jest runningSaveContract
 */
import * as fs from 'fs';
import * as path from 'path';

import { parseRunRow, runRowFromSave } from '../src/domain/running/detail';
import { cropRun, indexAtDistance, savedTrack } from '../src/domain/running/edit';
import { parseGpx } from '../src/domain/running/gpx';
import { buildManualRunInput } from '../src/domain/running/manual';
import { initialRecorder } from '../src/domain/running/recorder';
import { buildSaveRunInput } from '../src/domain/running/save';
import { summarizeRun } from '../src/domain/running/summarize';

const GPX = path.join(__dirname, 'fixtures', 'gpx', 'steady-5k.gpx');
const FIXTURE = path.join(__dirname, '..', 'supabase', 'tests', 'fixtures', 'save-run-5k.json');
const CROP_FIXTURE = path.join(__dirname, '..', 'supabase', 'tests', 'fixtures', 'crop-run-5k.json');
const MANUAL_FIXTURE = path.join(__dirname, '..', 'supabase', 'tests', 'fixtures', 'manual-run.json');

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

/** The same 5K, saved and read back, with its first and last 500 m trimmed off. */
function buildCrop() {
  const run = parseRunRow(runRowFromSave(buildInput()));
  const track = savedTrack(run);
  const result = cropRun(run, indexAtDistance(track, 500), indexAtDistance(track, run.distanceM - 500));
  if (!result.ok) throw new Error(result.reason);
  return result.input;
}

it('the trim fixture matches what the app sends', () => {
  const input = buildCrop();
  if (process.env.UPDATE_FIXTURES) fs.writeFileSync(CROP_FIXTURE, JSON.stringify(input, null, 2) + '\n');
  const fixture = JSON.parse(fs.readFileSync(CROP_FIXTURE, 'utf8'));
  expect(fixture).toEqual(JSON.parse(JSON.stringify(input)));
});

it('the manual run fixture matches what the app sends', () => {
  const result = buildManualRunInput(
    {
      source: 'treadmill',
      distance: 3.1,
      unit: 'mi',
      movingSeconds: 1680,
      performedAt: new Date('2026-09-26T13:00:00Z'),
      title: '',
      note: 'Incline 1%',
      effort: 6,
      bodyweightKg: 75,
      mapVisibility: 'private',
    },
    '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    Date.parse('2026-09-27T00:00:00Z'),
  );
  if (!result.ok) throw new Error(result.error);
  if (process.env.UPDATE_FIXTURES) fs.writeFileSync(MANUAL_FIXTURE, JSON.stringify(result.input, null, 2) + '\n');
  const fixture = JSON.parse(fs.readFileSync(MANUAL_FIXTURE, 'utf8'));
  expect(fixture).toEqual(JSON.parse(JSON.stringify(result.input)));
});

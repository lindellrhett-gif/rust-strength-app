// The live project gets its migrations pasted into the SQL editor by hand,
// one at a time, so running the same file twice in a row must neither fail
// nor change anything. This applies each migration and then applies it
// again straight away, in order. (Going back and re-running an old one
// after later ones is not supported: later migrations reshape what the
// earlier ones created.)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { SEED, SEED_AFTER, migrationFiles, stubDb } from './harness.mjs';

test('every migration can be run twice in a row', async () => {
  const db = await stubDb();
  for (const m of migrationFiles()) {
    const sql = readFileSync(m.path, 'utf8');
    for (const pass of ['first', 'second']) {
      try {
        await db.exec(sql);
        await db.exec(`set search_path = "$user", public, extensions`);
      } catch (e) {
        assert.fail(`${m.name} failed on its ${pass} run: ${e.message}`);
      }
    }
    if (m.number === SEED_AFTER) await db.exec(readFileSync(SEED, 'utf8'));
  }
});

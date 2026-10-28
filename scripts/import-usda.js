/**
 * Loads USDA FoodData Central foods into the shared catalog (migration 0027).
 *
 * Download the JSON zips for Foundation, SR Legacy and Survey (FNDDS) from
 * https://fdc.nal.usda.gov/download-datasets/ and unzip them, then:
 *
 *   node scripts/import-usda.js <file.json> [<file.json> ...]           a dry run: counts only
 *   node scripts/import-usda.js <file.json> ... --out foods.json        also writes the rows
 *   node scripts/import-usda.js <file.json> ... --apply                 writes the live catalog
 *
 * --apply needs the project URL and the service role key, from the
 * environment or this repo's .env: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * and SUPABASE_SERVICE_ROLE_KEY. The key never goes in the app or the repo.
 * Running it again is safe: foods are matched by their USDA id and updated.
 */

const fs = require('fs');
const path = require('path');

const { mapDataset } = require('./usda');

const ROOT = path.join(__dirname, '..');
const BATCH = 500;

function readDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

async function apply(foods) {
  const env = { ...readDotEnv(), ...process.env };
  const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env or the environment) to apply.');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let done = 0;
  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc('import_usda_foods', { p_foods: batch });
    if (error) {
      console.error(`Stopped at food ${i + 1} of ${foods.length}: ${error.message}`);
      console.error('Everything before it is saved; running the same command again picks up from the start safely.');
      process.exit(1);
    }
    done += data;
    console.log(`  ${done} of ${foods.length}`);
  }
  console.log(`Imported ${done} foods.`);
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : null;
  const files = args.filter((a, i) => !a.startsWith('--') && (outIndex < 0 || i !== outIndex + 1));
  if (files.length === 0) {
    console.error('Usage: node scripts/import-usda.js <FoodData Central JSON file>... [--out foods.json] [--apply]');
    process.exit(1);
  }

  const all = [];
  const seen = new Set();
  for (const file of files) {
    const { dataset, foods, skipped } = mapDataset(JSON.parse(fs.readFileSync(file, 'utf8')));
    let duplicates = 0;
    for (const food of foods) {
      if (seen.has(food.source_ref)) duplicates += 1;
      else {
        seen.add(food.source_ref);
        all.push(food);
      }
    }
    const left = Object.entries(skipped).map(([why, n]) => `${n} ${why.replace('_', ' ')}`);
    if (duplicates) left.push(`${duplicates} already listed`);
    console.log(`${dataset}: ${foods.length - duplicates} foods${left.length ? ` (left out: ${left.join(', ')})` : ''}`);
  }
  const portions = all.reduce((n, f) => n + f.portions.length, 0);
  console.log(`In all: ${all.length} foods, ${portions} portions.`);

  if (out) {
    fs.writeFileSync(out, JSON.stringify(all));
    console.log(`Wrote ${out}.`);
  }
  if (args.includes('--apply')) await apply(all);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

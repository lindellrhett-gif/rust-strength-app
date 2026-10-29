/**
 * Builds the app's Acknowledgements: the food data it uses and the licence of
 * every open-source package that ships inside it.
 *
 * "Ships inside it" is read from the iOS bundle's source map, not from
 * package.json: that lists exactly the npm packages whose code is in the app,
 * and leaves out build tools. Native-only modules (no JavaScript in the
 * bundle) are added from package.json, and the few iOS libraries CocoaPods
 * pulls in from outside npm come from legal/vendor-licenses.
 *
 * Writes:
 *   src/legal/notices.ts             what the app shows
 *   legal/THIRD_PARTY_NOTICES.md     a reviewable snapshot
 *
 * Run: npm run notices                 (exports the iOS bundle first, about a minute)
 *      npm run notices -- --map <file> (reuse a source map from `expo export --source-maps`)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.notices-build');

/** In package.json but not in a release build: build-time plugins and the debug-only dev client. */
const NOT_SHIPPED = new Set(['@bacons/apple-targets', 'expo-dev-client']);

/** iOS libraries from CocoaPods rather than npm, with the licence files kept for them. */
const NATIVE_PODS = [
  {
    name: 'RevenueCat and RevenueCatUI',
    via: 'react-native-purchases',
    license: 'MIT',
    file: 'purchases-ios.LICENSE',
  },
  {
    name: 'PurchasesHybridCommon and PurchasesHybridCommonUI 19.14.1',
    via: 'react-native-purchases',
    license: 'MIT',
    file: 'purchases-hybrid-common.LICENSE',
  },
  {
    name: 'ZXingObjC',
    via: 'expo-camera',
    license: 'Apache-2.0',
    file: 'zxingify-objc.COPYING',
    notice: 'zxingify-objc.NOTICE',
    copyright: 'Copyright the ZXing authors',
  },
];

// --- Which packages ship ---------------------------------------------------

function sourceMapPath() {
  const i = process.argv.indexOf('--map');
  if (i > 0 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  fs.rmSync(OUT, { recursive: true, force: true });
  // Through Node rather than `npx`, which is a .cmd shim on Windows.
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli'), 'export', '--platform', 'ios', '--source-maps', '--output-dir', OUT],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CI: '1' } },
  );
  const find = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? find(p) : p.endsWith('.map') ? [p] : [];
    });
  const maps = find(OUT);
  if (maps.length === 0) throw new Error('The export wrote no source map.');
  return maps[0];
}

/** "/node_modules/a/node_modules/@b/c/lib/x.js" -> "node_modules/a/node_modules/@b/c". */
function packageDir(source) {
  const i = source.lastIndexOf('node_modules/');
  if (i < 0) return null;
  const rest = source.slice(i + 'node_modules/'.length).split('/');
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  return source.slice(0, i).replace(/^\//, '') + 'node_modules/' + name;
}

function shippedPackageDirs(mapFile) {
  const { sources } = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const dirs = new Set(sources.map(packageDir).filter(Boolean));
  // Native modules with no JavaScript in the bundle still ship their native code.
  const deps = Object.keys(require(path.join(ROOT, 'package.json')).dependencies);
  const names = new Set([...dirs].map((d) => readJson(path.join(ROOT, d, 'package.json'))?.name));
  for (const name of deps) {
    if (NOT_SHIPPED.has(name) || names.has(name)) continue;
    const dir = path.join('node_modules', name);
    const hasNative = ['ios', 'expo-module.config.json'].some((f) => fs.existsSync(path.join(ROOT, dir, f)));
    if (hasNative) dirs.add(dir);
  }
  return [...dirs];
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// --- Licences --------------------------------------------------------------

const LICENSE_FILE = /^(licen[cs]e|copying)([-.](mit|md|txt|markdown))*$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;
// A notice line ("Copyright (c) 2015 Jane Doe"), not licence wording that
// mentions copyright ("copyright notice and this permission notice…").
const COPYRIGHT_LINE = /^\s*(copyright\b|\(c\)|©)(?!\s+(notice|holders?|owners?|and|law|laws|license)\b)/i;
const TITLE_LINE = /^\s*(the\s+)?(mit|isc|bsd[\w\s-]*|apache)\s+licen[cs]e(\s*\(mit\))?\s*$|^\s*\((the )?mit licen[cs]e\)\s*$/i;
const RULE_LINE = /^\s*[=\-_*]{3,}\s*$/;

const LICENSE_TITLES = {
  MIT: 'MIT License',
  ISC: 'ISC License',
  '0BSD': 'Zero-Clause BSD License',
  'Apache-2.0': 'Apache License 2.0',
  'BSD-2-Clause': 'BSD 2-Clause License',
  'BSD-3-Clause': 'BSD 3-Clause License',
};

function firstFile(dir, pattern) {
  try {
    const name = fs.readdirSync(dir).find((f) => pattern.test(f));
    return name ? fs.readFileSync(path.join(dir, name), 'utf8') : null;
  } catch {
    return null;
  }
}

function spdx(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'See the package';
}

/** A licence's text without its copyright and title lines, for grouping identical licences. */
function splitLicense(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    // Markdown headings and underlines in a LICENSE.md are formatting, not wording.
    .map((l) => l.replace(/^\s*#+\s*/, '').replace(/\s*={3,}\s*$/, ''))
    .filter((l) => !RULE_LINE.test(l));
  const copyrights = lines.filter((l) => COPYRIGHT_LINE.test(l)).map((l) => l.trim());
  const body = lines.filter((l) => !COPYRIGHT_LINE.test(l) && !TITLE_LINE.test(l)).join('\n').trim();
  return { copyrights, body };
}

/** Hard-wrapped paragraphs joined back into lines, so they wrap to the screen. */
const LIST_ITEM = /^(\*|-|\d+\.|\([a-z0-9]+\))\s/i;

function unwrap(text) {
  return text
    .split(/\n\s*\n/)
    // A list item inside a paragraph starts a new line rather than running on.
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .reduce((acc, l) => (acc && !LIST_ITEM.test(l) ? `${acc} ${l}` : acc ? `${acc}\n${l}` : l), ''),
    )
    .filter(Boolean)
    // Nothing in a licence should read as a heading or table to the renderer.
    .map((p) => p.replace(/^[#|]+\s*/gm, ''))
    .join('\n\n');
}

const keyOf = (body) => body.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function collect(dirs) {
  const groups = new Map();
  const add = (entry, text, license) => {
    const { copyrights, body } = text ? splitLicense(text) : { copyrights: [], body: '' };
    const key = body ? keyOf(body) : `id:${license}`;
    if (!groups.has(key)) groups.set(key, { license, body, entries: [] });
    const g = groups.get(key);
    if (!g.body && body) g.body = body;
    g.entries.push({ ...entry, copyrights: entry.copyrights ?? copyrights });
  };

  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    const pkg = readJson(path.join(abs, 'package.json'));
    if (!pkg?.name) continue;
    const text = firstFile(abs, LICENSE_FILE);
    const notice = firstFile(abs, NOTICE_FILE);
    add({ label: `${pkg.name} ${pkg.version}`, notice }, text, spdx(pkg));
  }
  for (const pod of NATIVE_PODS) {
    const text = fs.readFileSync(path.join(ROOT, 'legal', 'vendor-licenses', pod.file), 'utf8');
    const notice = pod.notice ? fs.readFileSync(path.join(ROOT, 'legal', 'vendor-licenses', pod.notice), 'utf8') : null;
    add({ label: `${pod.name} (iOS, used by ${pod.via})`, notice, copyrights: pod.copyright ? [pod.copyright] : undefined }, text, pod.license);
  }

  // A package without a licence file joins the group with its licence's text, if there is one.
  for (const [key, g] of groups) {
    if (g.body) continue;
    const match = [...groups.values()].find((o) => o !== g && o.body && o.license === g.license);
    if (match) {
      match.entries.push(...g.entries.map((e) => ({ ...e, fromPackageJson: true })));
      groups.delete(key);
    }
  }
  return [...groups.values()].sort((a, b) => b.entries.length - a.entries.length || a.license.localeCompare(b.license));
}

// --- Output ----------------------------------------------------------------

const FOOD_DATA = `## Food data

**USDA FoodData Central.** The everyday foods in the food diary come from FoodData Central's Foundation Foods, SR Legacy and Survey (FNDDS) data. FoodData Central data are in the public domain, published under CC0 1.0 Universal. Source: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov.

**Open Food Facts.** Packaged foods you scan or search for come from Open Food Facts (world.openfoodfacts.org), a database built by its users. Contains data from Open Food Facts, available under the Open Database License (ODbL) 1.0. Individual contents of the database are available under the Database Contents License (DbCL) 1.0. Entries can be wrong or incomplete; check the label.

**Daily Values.** The suggested nutrient targets are the Daily Values the US Food and Drug Administration sets for food labels, for a 2,000-calorie diet.

**The calorie goal** uses the Mifflin-St Jeor equation: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.`;

function render(groups) {
  const count = groups.reduce((n, g) => n + g.entries.length, 0);
  const parts = [
    '# Acknowledgements',
    '',
    FOOD_DATA,
    '',
    '## Open-source software',
    '',
    `Rust Strength is built with ${count} open-source packages and libraries. Each is used under its licence, reproduced below with the copyright notices its authors give.`,
  ];
  for (const g of groups) {
    parts.push('', `### ${LICENSE_TITLES[g.license] ?? g.license}`, '');
    for (const e of [...g.entries].sort((a, b) => a.label.localeCompare(b.label))) {
      const who = e.copyrights.length ? ` (${[...new Set(e.copyrights)].join('; ')})` : '';
      parts.push(`- ${e.label}${who}${e.fromPackageJson ? ', licence as stated in its package.json' : ''}`);
    }
    if (g.body) parts.push('', unwrap(g.body));
    for (const e of g.entries.filter((x) => x.notice)) {
      parts.push('', `**Notice for ${e.label}:**`, '', unwrap(e.notice));
    }
  }
  return parts.join('\n') + '\n';
}

const groups = collect(shippedPackageDirs(sourceMapPath()));
const markdown = render(groups);

fs.writeFileSync(path.join(ROOT, 'legal', 'THIRD_PARTY_NOTICES.md'), markdown);
fs.writeFileSync(
  path.join(ROOT, 'src', 'legal', 'notices.ts'),
  [
    '// Generated by scripts/build-notices.js (npm run notices). Do not edit by hand.',
    '',
    '/** The Acknowledgements screen: food data sources and open-source licences. */',
    `export const THIRD_PARTY_NOTICES: string = ${JSON.stringify(markdown)};`,
    '',
  ].join('\n'),
);
fs.rmSync(OUT, { recursive: true, force: true });
console.log(`Wrote src/legal/notices.ts and legal/THIRD_PARTY_NOTICES.md: ${groups.reduce((n, g) => n + g.entries.length, 0)} packages, ${groups.length} licence texts, ${Math.round(markdown.length / 1024)} KB.`);

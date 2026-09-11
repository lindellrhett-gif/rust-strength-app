import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rust Strength draws its own icons. Every symbol on screen is a glyph from
 * `TrophyIcon`, on one 24x24 grid with one stroke weight, which is what keeps a
 * flame, a barbell and a semi truck looking like members of one set. A pasted
 * emoji renders in the system font and breaks that instantly — and looks
 * different on every phone.
 *
 * This test is the guard. If it fails, draw the glyph instead.
 */

const ROOTS = ['app', 'src'];

/**
 * Emoji and pictographic dingbats. Deliberately does NOT cover the typographic
 * marks the app does use on purpose — the middot, en dash, em dash, multiply
 * sign, single guillemets, arrows in comments, or the check mark.
 */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

/** Typographic characters that are wanted, checked before flagging a line. */
const ALLOWED = /[←→✓▲▼]/u;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('no emoji in the app', () => {
  const files = ROOTS.flatMap((root) => walk(join(process.cwd(), root)));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has none anywhere in app/ or src/', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!EMOJI.test(line)) return;
        // Strip the characters we deliberately keep, then re-test.
        if (!EMOJI.test(line.replace(new RegExp(ALLOWED, 'gu'), ''))) return;
        offenders.push(`${file.replace(process.cwd(), '').slice(1)}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});

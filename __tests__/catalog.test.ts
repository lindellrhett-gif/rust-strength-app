import { readFileSync } from 'node:fs';

import { ACTIVITY_FIELDS, ACTIVITY_GROUPS, ACTIVITY_KINDS, ACTIVITY_LABEL } from '../src/domain/activities';
import { LOAD_TYPES } from '../src/domain/loadType';
import { MUSCLE_GROUPS } from '../src/domain/stats';

const migration = readFileSync('supabase/migrations/0011_exercise_types_catalog.sql', 'utf8');

/** The catalog rows: ('Name', 'group', 'equipment', 'load_type'). */
const rows = [
  ...migration.matchAll(
    /\(\s*'((?:[^']|'')+)',\s*'(\w+)',\s*'(\w+)',\s*'(\w+)'\s*\)/g,
  ),
].map((m) => ({
  name: m[1].replace(/''/g, "'"),
  group: m[2],
  equipment: m[3],
  loadType: m[4],
}));

const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands'];

describe('exercise catalog', () => {
  it('is a real catalog, not a handful', () => {
    expect(rows.length).toBeGreaterThan(200);
  });

  it('uses only valid muscle groups, equipment and load types', () => {
    for (const row of rows) {
      expect(MUSCLE_GROUPS).toContain(row.group);
      expect(EQUIPMENT).toContain(row.equipment);
      expect(LOAD_TYPES).toContain(row.loadType);
    }
  });

  it('lists each name once', () => {
    const names = rows.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers every muscle group', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(rows.some((r) => r.group === group)).toBe(true);
    }
  });

  it('marks assisted exercises as assisted, and only those', () => {
    for (const row of rows) {
      expect(row.loadType === 'assisted').toBe(/assisted/i.test(row.name));
    }
  });

  it('offers both a bodyweight and an assisted version of pull-ups and dips', () => {
    const find = (name: string) => rows.find((r) => r.name === name)?.loadType;
    expect(find('Pull-Up')).toBe('bodyweight');
    expect(find('Assisted Pull-Up')).toBe('assisted');
    expect(find('Dip')).toBe('bodyweight');
    expect(find('Assisted Dip')).toBe('assisted');
    expect(find('Push-Up')).toBe('bodyweight');
  });

  it('gives bodyweight exercises no equipment requirement', () => {
    for (const row of rows.filter((r) => r.loadType === 'bodyweight')) {
      expect(row.equipment).toBe('bodyweight');
    }
  });
});

describe('activity kinds', () => {
  const enumValues = [
    ...readFileSync('supabase/migrations/0005_activities.sql', 'utf8')
      .match(/create type activity_kind as enum \(([\s\S]*?)\);/)![1]
      .matchAll(/'(\w+)'/g),
    ...migration.matchAll(/add value if not exists '(\w+)'/g),
  ].map((m) => m[1]);

  it('matches the database enum exactly', () => {
    expect([...ACTIVITY_KINDS].sort()).toEqual([...enumValues].sort());
  });

  it('includes pickleball and other sports', () => {
    for (const kind of ['pickleball', 'volleyball', 'golf', 'football', 'hockey']) {
      expect(ACTIVITY_KINDS).toContain(kind);
    }
  });

  it('puts every kind in exactly one group', () => {
    const grouped = ACTIVITY_GROUPS.flatMap((g) => g.kinds);
    expect([...grouped].sort()).toEqual([...ACTIVITY_KINDS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('labels every kind and decides its fields', () => {
    for (const kind of ACTIVITY_KINDS) {
      expect(ACTIVITY_LABEL[kind].length).toBeGreaterThan(0);
      expect(ACTIVITY_FIELDS[kind]).toBeDefined();
    }
  });
});

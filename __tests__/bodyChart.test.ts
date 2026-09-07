import {
  coverageLevel,
  buildBodyChart,
  missedGroups,
  chartSummary,
  GROUP_SIDE,
  GROUP_LABEL,
} from '@/domain/bodyChart';
import { MUSCLE_GROUPS } from '@/domain/stats';

describe('coverageLevel', () => {
  it('grades from none through heavy', () => {
    expect(coverageLevel(0)).toBe('none');
    expect(coverageLevel(1)).toBe('light');
    expect(coverageLevel(3)).toBe('light');
    expect(coverageLevel(4)).toBe('solid');
    expect(coverageLevel(8)).toBe('solid');
    expect(coverageLevel(9)).toBe('heavy');
    expect(coverageLevel(30)).toBe('heavy');
  });

  it('treats nonsense as untrained', () => {
    expect(coverageLevel(NaN)).toBe('none');
    expect(coverageLevel(-3)).toBe('none');
  });
});

describe('buildBodyChart', () => {
  it('covers every muscle group the app tracks', () => {
    const regions = buildBodyChart({});
    expect(regions).toHaveLength(MUSCLE_GROUPS.length);
    expect(regions.map((r) => r.group).sort()).toEqual([...MUSCLE_GROUPS].sort());
  });

  it('places every group on a side of the body', () => {
    for (const g of MUSCLE_GROUPS) {
      expect(['front', 'back']).toContain(GROUP_SIDE[g]);
      expect(GROUP_LABEL[g]).toBeTruthy();
    }
  });

  it('grades each region from this week set counts', () => {
    const regions = buildBodyChart({ chest: 6, back: 1, quads: 0 });
    const byGroup = Object.fromEntries(regions.map((r) => [r.group, r]));
    expect(byGroup.chest.level).toBe('solid');
    expect(byGroup.chest.sets).toBe(6);
    expect(byGroup.back.level).toBe('light');
    expect(byGroup.quads.level).toBe('none');
    expect(byGroup.calves.level).toBe('none');
  });
});

describe('missedGroups', () => {
  it('lists only untrained groups', () => {
    const regions = buildBodyChart({ chest: 4, back: 4 });
    const missed = missedGroups(regions);
    expect(missed).not.toContain('chest');
    expect(missed).toContain('calves');
    expect(missed).toHaveLength(MUSCLE_GROUPS.length - 2);
  });

  it('is empty when everything was trained', () => {
    const full = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 3]));
    expect(missedGroups(buildBodyChart(full))).toEqual([]);
  });
});

describe('chartSummary', () => {
  it('reports nothing logged for an empty week', () => {
    const s = chartSummary(buildBodyChart({}));
    expect(s.trained).toBe(0);
    expect(s.fraction).toBe(0);
    expect(s.headline).toMatch(/Nothing logged/i);
  });

  it('celebrates a full-body week', () => {
    const full = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 2]));
    const s = chartSummary(buildBodyChart(full));
    expect(s.trained).toBe(s.total);
    expect(s.fraction).toBe(1);
    expect(s.headline).toMatch(/Full body/i);
  });

  it('names what is still missing, capped at three', () => {
    const s = chartSummary(buildBodyChart({ chest: 4 }));
    expect(s.headline).toMatch(/^Still to hit: /);
    expect(s.headline).toMatch(/\+\d+ more/);
    expect(s.headline).not.toMatch(/chest/);
  });

  it('does not add "more" when three or fewer are missing', () => {
    const most = Object.fromEntries(
      MUSCLE_GROUPS.filter((g) => g !== 'calves' && g !== 'core').map((g) => [g, 3]),
    );
    const s = chartSummary(buildBodyChart(most));
    expect(s.headline).toMatch(/calves/);
    expect(s.headline).not.toMatch(/more/);
  });
});

import {
  MAX_BODY_LENGTH,
  ONBOARDING_CARDS,
  cardCount,
  clampCardIndex,
  isLastCard,
  onboardingKey,
  primaryLabel,
} from '@/domain/onboarding';

describe('the onboarding deck', () => {
  it('is short enough that someone will actually read it', () => {
    expect(cardCount()).toBeGreaterThanOrEqual(3);
    expect(cardCount()).toBeLessThanOrEqual(6);
  });

  it('has no duplicate ids', () => {
    const ids = ONBOARDING_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every card a title, a body and a drawn glyph', () => {
    for (const card of ONBOARDING_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.body.length).toBeGreaterThan(0);
      expect(card.glyph.length).toBeGreaterThan(0);
    }
  });

  it('keeps every body skimmable on a phone', () => {
    for (const card of ONBOARDING_CARDS) {
      expect(card.body.length).toBeLessThanOrEqual(MAX_BODY_LENGTH);
    }
  });

  it('uses no emoji anywhere — the app draws its own icons', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const card of ONBOARDING_CARDS) {
      expect(card.title).not.toMatch(emoji);
      expect(card.body).not.toMatch(emoji);
      expect(card.glyph).not.toMatch(emoji);
      if (card.footnote) expect(card.footnote).not.toMatch(emoji);
    }
  });

  it('makes no health, results or safety claim', () => {
    // These are the words that turn a description into a claim, which is both
    // an App Review problem and an advertising one.
    const banned = [
      'guarantee',
      'guaranteed',
      'prevent injury',
      'injury-free',
      'burn fat',
      'lose weight',
      'cure',
      'treat',
      'diagnose',
      'safe to lift',
      'will make you',
    ];
    const wording = ONBOARDING_CARDS.map((c) => `${c.title} ${c.body} ${c.footnote ?? ''}`)
      .join(' ')
      .toLowerCase();
    for (const phrase of banned) expect(wording).not.toContain(phrase);
  });

  it('says plainly that it is not medical or coaching advice', () => {
    const footnotes = ONBOARDING_CARDS.map((c) => c.footnote ?? '').join(' ');
    expect(footnotes.toLowerCase()).toContain('not medical');
  });

  it('explains the thing that makes the app different', () => {
    const wording = ONBOARDING_CARDS.map((c) => c.body.toLowerCase()).join(' ');
    expect(wording).toContain('rpe');
    expect(wording).toContain('machine');
    expect(wording).toContain('one-rep max');
  });
});

describe('paging', () => {
  it('knows where the end is', () => {
    expect(isLastCard(cardCount() - 1)).toBe(true);
    expect(isLastCard(0)).toBe(false);
  });

  it('labels the button for where you are', () => {
    expect(primaryLabel(0)).toBe('Next');
    expect(primaryLabel(cardCount() - 1)).toBe('Start lifting');
  });

  it('clamps an index to the deck', () => {
    expect(clampCardIndex(-3)).toBe(0);
    expect(clampCardIndex(99)).toBe(cardCount() - 1);
    expect(clampCardIndex(1.4)).toBe(1);
    expect(clampCardIndex(1.6)).toBe(2);
  });

  it('survives a NaN from a mid-swipe measurement', () => {
    expect(clampCardIndex(Number.NaN)).toBe(0);
  });
});

describe('onboardingKey', () => {
  it('is scoped per account, so a second user sees the cards too', () => {
    expect(onboardingKey('user-a')).not.toBe(onboardingKey('user-b'));
  });

  it('is stable for the same account', () => {
    expect(onboardingKey('user-a')).toBe(onboardingKey('user-a'));
  });
});

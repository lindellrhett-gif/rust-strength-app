import { settledOrAfter } from '../src/lib/pullRefresh';

describe('settledOrAfter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const isDone = async (p: Promise<void>) => {
    let done = false;
    void p.then(() => {
      done = true;
    });
    // Let the promise callbacks run.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return done;
  };

  it('finishes when the work finishes', async () => {
    expect(await isDone(settledOrAfter(Promise.resolve()))).toBe(true);
  });

  it('finishes when the work fails, without passing the failure on', async () => {
    expect(await isDone(settledOrAfter(Promise.reject(new Error('no network'))))).toBe(true);
  });

  it('stops waiting for work that never settles, as a paused refetch doesn’t', async () => {
    const paused = settledOrAfter(new Promise(() => undefined), 4000);
    expect(await isDone(paused)).toBe(false);
    jest.advanceTimersByTime(3999);
    expect(await isDone(paused)).toBe(false);
    jest.advanceTimersByTime(1);
    expect(await isDone(paused)).toBe(true);
  });
});

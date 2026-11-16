import { describe, expect, it } from 'vitest';
import { launchHash, MAX_TITLE, parseLaunch } from './launch.js';

describe('parseLaunch', () => {
  it('is null for any hash that does not ask for the add sheet', () => {
    expect(parseLaunch('')).toBeNull();
    expect(parseLaunch('#')).toBeNull();
    expect(parseLaunch('#title=Milk')).toBeNull();
    expect(parseLaunch('#something')).toBeNull();
  });

  it('reads a bare #add as the sheet with its own defaults', () => {
    expect(parseLaunch('#add')).toEqual({ quadrant: null, title: '' });
    expect(parseLaunch('#add=')).toEqual({ quadrant: null, title: '' });
  });

  it('reads the quadrant the launcher shortcuts name', () => {
    for (const q of ['do', 'schedule', 'delegate', 'later'] as const) {
      expect(parseLaunch(`#add=${q}`)).toEqual({ quadrant: q, title: '' });
    }
  });

  it('ignores a quadrant it does not know, but still opens the sheet', () => {
    expect(parseLaunch('#add=someday&title=x')).toEqual({ quadrant: null, title: 'x' });
  });

  it('decodes the title the way Android encodes it (+ and %20 are spaces)', () => {
    expect(parseLaunch('#add&title=Buy+milk%20today')?.title).toBe('Buy milk today');
    expect(parseLaunch('#add&title=1%2B1%3D2%20%26%20%C3%A9')?.title).toBe('1+1=2 & é');
  });

  it('folds a shared multi-line text into one trimmed line, capped', () => {
    expect(parseLaunch(`#add&title=${encodeURIComponent('  Read\n\nthis  article \t')}`)?.title).toBe(
      'Read this article',
    );
    const long = 'x'.repeat(MAX_TITLE + 50);
    expect(parseLaunch(`#add&title=${long}`)?.title).toHaveLength(MAX_TITLE);
  });

  it('works without the leading #', () => {
    expect(parseLaunch('add=do')).toEqual({ quadrant: 'do', title: '' });
  });
});

describe('launchHash', () => {
  it('round-trips through parseLaunch', () => {
    const cases = [
      { quadrant: null, title: '' },
      { quadrant: 'do' as const, title: '' },
      { quadrant: 'later' as const, title: 'Call mum & dad' },
      { quadrant: null, title: 'Shared from the browser' },
    ];
    for (const c of cases) expect(parseLaunch(launchHash(c))).toEqual(c);
  });

  it('writes the plain forms the shortcuts use', () => {
    expect(launchHash({ quadrant: null, title: '' })).toBe('#add');
    expect(launchHash({ quadrant: 'do', title: '' })).toBe('#add=do');
    expect(launchHash({ quadrant: null, title: 'a b' })).toBe('#add&title=a+b');
  });
});

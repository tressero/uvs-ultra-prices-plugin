import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildInfo, readVersion, REPO_URL } from '../../tools/lib/version.mjs';

// Compare against the file rather than a literal, so bumping the version does
// not break the test that guards it.
const declared = readFileSync(new URL('../../VERSION.txt', import.meta.url), 'utf8').trim();

describe('build identity', () => {
  it('reads the SemVer core from VERSION.txt', () => {
    expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
    expect(readVersion()).toBe(declared);
  });

  it('appends the commit to the build label', () => {
    const info = buildInfo();
    expect(info.version).toBe(declared);
    expect(info.label).toMatch(/^\d+\.\d+\.\d+\.[0-9a-f]{7}$|^\d+\.\d+\.\d+\.local$/);
    if (info.full) expect(info.commitUrl).toBe(`${REPO_URL}/commit/${info.full}`);
  });
});

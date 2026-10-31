import { describe, expect, it } from 'vitest';
import { buildInfo, readVersion, REPO_URL } from '../../tools/lib/version.mjs';

describe('build identity', () => {
  it('reads the SemVer core from VERSION.txt', () => {
    expect(readVersion()).toBe('1.1.0');
  });

  it('appends the commit to the build label', () => {
    const info = buildInfo();
    expect(info.version).toBe('1.1.0');
    expect(info.label).toMatch(/^1\.1\.0\.[0-9a-f]{7}$|^1\.1\.0\.local$/);
    if (info.full) expect(info.commitUrl).toBe(`${REPO_URL}/commit/${info.full}`);
  });
});

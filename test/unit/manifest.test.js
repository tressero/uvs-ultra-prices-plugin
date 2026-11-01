import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { composeManifest, hostPermissionsFor } from '../../tools/lib/manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = JSON.parse(readFileSync(join(ROOT, 'extension', 'src', 'manifest.json'), 'utf8'));
const firefox = JSON.parse(
  readFileSync(join(ROOT, 'extension', 'src', 'manifest.firefox.json'), 'utf8'),
);
const build = { version: '1.1.0', hostPermissions: ['https://uvsultra.online/*'] };

describe('browser manifests', () => {
  it('keeps the Chrome manifest on a service worker', () => {
    const manifest = composeManifest(base, {}, build);
    expect(manifest.background).toEqual({ service_worker: 'sw.js', type: 'module' });
    expect(manifest.browser_specific_settings).toBeUndefined();
    expect(manifest.version).toBe('1.1.0');
  });

  it('turns the Firefox background into an event page', () => {
    const manifest = composeManifest(base, firefox, build);
    expect(manifest.background).toEqual({ scripts: ['sw.js'] });
    expect(manifest.background.service_worker).toBeUndefined();
  });

  it('declares the Gecko identity, minimum versions and data collection', () => {
    const manifest = composeManifest(base, firefox, build);
    const gecko = manifest.browser_specific_settings.gecko;
    expect(gecko.id).toBe('uvs-ultra-prices@tressero.com');
    expect(gecko.strict_min_version).toBe('140.0');
    expect(gecko.data_collection_permissions.required).toEqual(['websiteContent']);
    expect(manifest.browser_specific_settings.gecko_android.strict_min_version).toBe('142.0');
  });

  it('adds the pricing worker origin to both manifests', () => {
    const permissions = hostPermissionsFor(base, {
      workerOrigin: 'https://uvs-ultra-prices.example.workers.dev',
      dev: false,
    });
    expect(permissions).toContain('https://uvs-ultra-prices.example.workers.dev/*');
    expect(permissions).not.toContain('http://localhost:8787/*');
  });

  it('adds localhost to development builds', () => {
    const permissions = hostPermissionsFor(base, {
      workerOrigin: 'https://uvs-ultra-prices.example.workers.dev',
      dev: true,
    });
    expect(permissions).toContain('http://localhost:8787/*');
  });
});

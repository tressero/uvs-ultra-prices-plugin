/**
 * Compose the per-browser manifest.
 *
 * `extension/src/manifest.json` is shared. The Firefox build merges
 * `extension/src/manifest.firefox.json` over it: an event page instead of a
 * service worker, plus the Gecko identity and data-collection declaration AMO
 * requires. The build owns the version and host permissions in both cases.
 */

/**
 * @param {object} base shared manifest
 * @param {object} overlay browser-specific keys (empty for Chrome)
 * @param {{version: string, hostPermissions: string[]}} build
 */
export function composeManifest(base, overlay, { version, hostPermissions }) {
  return {
    ...base,
    ...overlay,
    version,
    host_permissions: [...hostPermissions],
  };
}

/**
 * Only the origin the extension talks to gets a host permission, plus the local
 * fixture server in development builds.
 *
 * @param {object} base shared manifest
 * @param {{workerOrigin: string, dev: boolean}} options
 */
export function hostPermissionsFor(base, { workerOrigin, dev }) {
  const permissions = new Set([...base.host_permissions, `${workerOrigin}/*`]);
  if (dev) permissions.add('http://localhost:8787/*');
  return [...permissions];
}

# Building the Firefox add-on for AMO review

This archive contains the source for **UVS Ultra Deck Prices**, a WebExtension
that adds TCGplayer prices to [uvsultra.online](https://uvsultra.online).

The shipped Firefox build is bundled and minified with [esbuild](https://esbuild.github.io/),
so the add-on package is not directly reviewable. This archive is the original
source plus the exact build steps.

## Environment

- Linux, macOS or Windows
- Node.js 20 (see `.nvmrc`; built with Node 20.20.2 and npm 10.8.2)
- No web-based build service is used

## Build

```bash
npm ci
npm run build-for-amo
```

`npm run build-for-amo` is:

```bash
node build.mjs --firefox
```

Output:

- `dist-firefox/` — the unpacked add-on, with `manifest.json` at its root

To produce the exact upload archive after the rebuild:

```bash
npm run package:firefox   # dist-firefox.zip
```

The Firefox manifest is generated from `extension/src/manifest.json` plus the
Firefox overlay in `extension/src/manifest.firefox.json`. The build adds the
pricing-worker host permission from `config/worker.json`.

## Notes

- `package-lock.json` pins the toolchain; `npm ci` reproduces it exactly.
- `.npmrc` sets `playwright_skip_browser_download=1`. Playwright is only used by
  the repository's local preview tooling, not by this build.
- `data/prices.snapshot.json` and `data/set-map.json` are committed, so the
  build uses no network.
- The Firefox build intentionally does not embed the git commit in the bundle or
  `version.txt`; that keeps this rebuild byte-for-byte comparable with the
  submitted package. The GitHub release tag and zip filename carry the commit.
- Source maps are not produced in production builds.

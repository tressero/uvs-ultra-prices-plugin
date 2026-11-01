# Releasing Chrome and Firefox builds

One tag publishes both browsers. Chrome goes to the Chrome Web Store when its
secrets are configured; Firefox is submitted to addons.mozilla.org (AMO) after
the first listing exists.

## Release assets

| Asset | Purpose |
| --- | --- |
| `dist-<version>.<sha>.zip` | Chrome manual install / Chrome Web Store |
| `dist.zip` | Stable alias for the Chrome Web Store upload |
| `dist-firefox-<version>.<sha>.zip` | Firefox manual install / AMO upload |
| `dist-firefox.zip` | Stable alias for the AMO upload |
| `uvs-ultra-prices-source-<version>.<sha>.zip` | Source archive required by AMO reviewers |

The Firefox package is reproducible: its bundle and `version.txt` contain only
the SemVer version, so an AMO rebuild from the source archive matches. The
commit stays in the GitHub tag and the archive filename.

## Version numbers

`VERSION.txt` and `package.json` hold the SemVer core and must match. Bump both
in the release PR:

- **Chrome Web Store:** a version can only be uploaded once.
- **AMO:** a version can only be used once, and the same number cannot be used on
  both the listed and unlisted channels.
- The build label (`<version>.<sha>`) and git tag (`v<version>.<sha>`) are
  computed, not stored.

## Pre-release checklist

```bash
npm ci
npm test

npm run build
npm run build:firefox

npm run package
npm run package:firefox

npm run lint:firefox      # must be 0 errors, 0 warnings
npm run source:firefox    # AMO source archive
```

Smoke-test both builds:

- Chrome: load `dist/` unpacked, open a deck, a Top Decks page, a search result
  and the popup.
- Firefox: load `dist-firefox/manifest.json` through `about:debugging`, repeat
  the same checks, and confirm the popup still shows live prices.

`npm run preview` covers the Chromium flow against local fixtures. There is no
equivalent Firefox fixture runner yet; use a real deck in Firefox.

## Merge, then tag

```bash
git checkout main
git pull
npm run release -- --title "What this release is"
```

The tag push triggers CI, which:

1. runs the test suite;
2. builds and packages Chrome and Firefox;
3. runs `web-ext lint` on the Firefox build;
4. builds the AMO source archive;
5. creates the GitHub release and attaches all three archives;
6. uploads to the Chrome Web Store when its secrets exist;
7. submits to AMO when its secrets exist **and** the repository variable
   `AMO_PUBLISH` is `true`;
8. deploys the pricing worker when Cloudflare secrets exist.

The AMO step uses `--approval-timeout 0`, so it submits and returns instead of
waiting for review. It is non-blocking: a failed submission does not fail the
GitHub release.

## First Firefox submission (manual)

Do this once, before enabling `AMO_PUBLISH`.

1. Create an add-on at <https://addons.mozilla.org/developers/>.
   - Add-on ID: `uvs-ultra-prices@tressero.com` (already in the manifest).
   - License: MIT.
2. Run the pre-release checklist.
3. Upload `dist-firefox.zip`.
4. Upload `uvs-ultra-prices-source-<version>.<sha>.zip` as the source code
   archive.
5. Fill the listing from [`docs/firefox-listing.md`](firefox-listing.md).
6. Add the three screenshots from `store/screenshots/`.
7. Submit for review. Review can take hours or days.
8. After the listing is live, create the `AMO_PUBLISH` repository variable and
   add `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` from
   <https://addons.mozilla.org/developers/addon/api/key/>.

## Later Firefox submissions

Once the listing and secrets exist, the tag release submits automatically. To
submit by hand instead:

```bash
AMO_JWT_ISSUER=... AMO_JWT_SECRET=... npm run sign:firefox
```

The command uploads the source archive automatically. It never reuses a version:
bump `VERSION.txt` first if AMO has already seen it.

### Unlisted builds

`npm run sign:firefox -- --channel unlisted` produces a signed XPI for
self-distribution, but AMO requires its version to differ from the listed one.
Do not point GitHub users at an unlisted same-version build; the GitHub Firefox
zip is for temporary installs and the AMO listing is the permanent path.

## Worker and privacy pages

The privacy policy and landing page are served by the pricing worker:

- <https://uvs-ultra-prices.marc-ee2.workers.dev/privacy>
- <https://uvs-ultra-prices.marc-ee2.workers.dev/>

`docs/privacy.md` is the source; `worker/src/pages.js` mirrors it. Deploy the
worker before submitting a release whose privacy or landing copy changed, so
the URL on the store listing is already current. The tag release deploys it
when `CLOUDFLARE_API_TOKEN` is configured.

## If something fails

- **AMO says the version already exists:** bump `VERSION.txt` and `package.json`,
  rebuild, and submit the new version. AMO never releases a used version number.
- **AMO rejects the build:** fix, bump the version, and resubmit. The GitHub
  release can stay published; attach the replacement archives if needed.
- **Chrome upload fails:** the GitHub release still has `dist-<label>.zip` for a
  manual upload through the Chrome Web Store dashboard.
- **Firefox submission fails in CI:** run `npm run sign:firefox` locally, or
  upload `dist-firefox.zip` and the source archive through the AMO dashboard.

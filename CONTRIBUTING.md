# Contributing to UVS Ultra Deck Prices

Thanks for helping improve the extension. This guide covers the normal path from
an idea to a merged pull request. Release work (version bump, tag, store uploads)
is separate and lives in [`docs/releasing.md`](docs/releasing.md).

## Before you start

- **Open an issue first** for a new feature, a behavior change or anything that
  touches the pricing rules, the worker, or the extension's permissions. Describe
  the problem, the proposed behavior and who it helps. This project favors a
  small, honest UI over a clever one, so agreeing on the approach first avoids
  rework.
- **Small fixes can go straight to a pull request:** typos, broken links, a
  failing test, an obvious bug with a clear cause.
- **Do not open a pull request for a release.** Version bumps, tags and store
  uploads are maintainer work; see [`docs/releasing.md`](docs/releasing.md).

## Set up a development build

Requirements: Node.js 20 (see `.nvmrc`) and npm.

```bash
git clone https://github.com/tressero/uvs-ultra-prices-plugin.git
cd uvs-ultra-prices-plugin
npm ci

npm run build:dev          # Chrome -> dist-dev/
npm run build:firefox:dev  # Firefox -> dist-firefox-dev/
npm run preview            # Chromium + local fixtures, saves screenshots
```

Load `dist-dev/` in `chrome://extensions` with **Load unpacked**, or
`dist-firefox-dev/manifest.json` in `about:debugging#/runtime/this-firefox`.
The README's [Build and load from source](README.md#build-and-load-from-source)
section has the full steps. `npm run preview` is the fastest way to check a deck
page without installing anything by hand; it writes screenshots to
`/tmp/opencode/uvsp-*.png`.

## Checks before opening a pull request

Run these from a clean checkout:

```bash
npm test                 # unit and worker tests, no network
npm run build            # dist/ (Chrome)
npm run build:firefox    # dist-firefox/ (Firefox)
npm run lint:firefox     # required when the Firefox build changes
```

Add or update tests for behavior changes. The suite covers the parser, matcher,
totals, price metrics, Mass Entry links, the worker routes and the sync; a new
pricing rule or DOM shape should come with a test that would fail without the
change. If you change the DOM parsing, add a fixture under `fixtures/` rather
than reaching for the live site in a test.

Never commit `node_modules/`, `dist*/`, `*.zip`, `.wrangler/`, worker secrets or
`.dev.vars`; they are already in `.gitignore`.

## Branch and commit conventions

- Branch from `main` and use a short descriptive name:
  `fix/deck-total-rounding`, `feat/list-page-cache`, `docs/install-steps`.
- Keep one concern per branch and one concern per pull request. Do not mix a
  refactor with a behavior change.
- Write commit subjects in the imperative mood and keep the first line under
  about 72 characters: `Retry the quote message, and cover www`.
- Explain the *why* in the commit body when the subject cannot carry it. Mention
  the user-visible symptom, not just the code that changed.
- Do not force-push a branch that is under review unless the reviewer asked for
  it; add commits instead.

## Pull request description

Every pull request should answer these questions:

1. **Why is this needed?** The user-visible problem, the bug report or the issue
   number. "The deck total rounded down for fractional prices" is useful;
   "improve totals" is not.
2. **What changed?** A short list of the behavior and files that moved.
3. **How was it verified?** The exact commands you ran and what you saw. Include
   `npm test` results, and a screenshot or a preview output for UI changes.
4. **What are the risks?** Anything that could regress, plus how to back it out.
5. **What tools or prompts generated the code, if any?** See the next section.

The repository has a [pull request template](.github/pull_request_template.md)
with these headings; fill it in rather than replacing it with a wall of text.

## Generated code and AI assistance

AI assistants and code-generation tools are welcome, with disclosure:

- **Say what you used.** Name the assistant, model or tool and, for prompts,
  summarize the prompt or paste it. One or two lines is enough: "Scaffolded the
  chip change with <tool> from the prompt '…'; reviewed and edited by hand."
- **Take responsibility for it.** You are the author of the pull request. Read
  every line, remove anything that does not fit the project, and make sure the
  tests actually exercise the change.
- **Do not paste unreviewed output** that adds dependencies, analytics, remote
  code, permissions or network calls. Those need an explicit discussion in the
  issue first.
- **Generated text in docs is still docs.** Check links, commands and version
  numbers against the repository rather than trusting the model's memory.
- If no tool was used, write **None** in the template. An explicit "None" is
  better than leaving the section blank.

## What reviewers look for

- The change solves the stated problem and nothing else.
- Prices stay honest: no invented number, estimates remain marked `(Est.)`,
  totals with missing cards remain a lower bound (`≥`), and the deck total still
  equals the sum of the displayed row chips.
- New network calls, permissions or host matches are justified and documented in
  `docs/privacy.md` and the store listing notes.
- The code follows the existing structure: parsers in `extension/src/shared/`,
  shared pricing logic in `shared/`, rendering in `extension/src/content/`, API
  routes in `worker/src/`.
- Tests cover the change and pass in CI, including the Firefox lint step.
- The PR description explains the why, the verification and any AI/tool use.

## Where to make a change

| Area | Path |
| --- | --- |
| Deck, search and list parsing | `extension/src/shared/parse.js`, `cardinfo.js`, `list.js` |
| Pricing, matching and totals | `shared/match.js`, `metrics.js`, `estimate.js`, `rarity.js` |
| Deck, search and list rendering | `extension/src/content/` |
| Popup and settings | `extension/src/popup/`, `extension/src/shared/settings.js` |
| Background worker and cache | `extension/src/background/sw.js` |
| Pricing API and catalog sync | `worker/src/` |
| Tests | `test/unit/`, `test/worker/` |
| Fixtures and generated data | `fixtures/`, `data/` |
| Store copy and release runbook | `docs/` |

## License

By contributing you agree that your contribution is licensed under the
[MIT License](LICENSE), the same license as the project.

# Install from GitHub or build it yourself

The normal install path is the browser store. These instructions are for people
who want the exact build attached to a GitHub release, or who want to build from
source.

## From a GitHub release

Open the [latest release](https://github.com/tressero/uvs-ultra-prices-plugin/releases/latest)
and download the archive for your browser:

| Browser | Asset | Install |
| --- | --- | --- |
| Chrome, Edge, Brave | `dist-<version>.<sha>.zip` | Extract, then **Load unpacked** |
| Firefox | `dist-firefox-<version>.<sha>.zip` | Extract, then **Load Temporary Add-on** |

### Chrome / Chromium

1. Extract the zip to a folder you will keep (Chrome loads the folder, not the zip).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Choose **Load unpacked** and select the extracted folder — the one containing
   `manifest.json`.
5. Open a deck on <https://uvsultra.online>.

This stays installed until you remove it or Chrome disables developer-mode
extensions. Chrome may show a developer-mode warning at startup.

### Firefox

1. Extract the zip to a folder you will keep.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `manifest.json` inside the extracted folder.
5. Open a deck on <https://uvsultra.online>.

Firefox removes temporary add-ons when it restarts. A permanent install on
standard Firefox requires the signed copy from
[Firefox Add-ons](https://addons.mozilla.org/firefox/) once the listing is live.
The GitHub zip is unsigned; it is intended for testing and for Firefox builds
that allow unsigned add-ons.

## Build from source

Requirements: Node.js 20 (see `.nvmrc`) and npm.

```bash
git clone https://github.com/tressero/uvs-ultra-prices-plugin.git
cd uvs-ultra-prices-plugin
npm ci

# Chrome
npm run build          # -> dist/

# Firefox
npm run build:firefox  # -> dist-firefox/
```

Then load `dist/` or `dist-firefox/` using the steps above.

To create the same archives the release publishes:

```bash
npm run package          # dist-<label>.zip + dist.zip
npm run package:firefox  # dist-firefox-<label>.zip + dist-firefox.zip
```

`npm run package` and `npm run package:firefox` refuse to build if
`VERSION.txt`, `package.json` and the generated manifest disagree, or if
`config/worker.json` still holds the placeholder worker URL.

## Updating

- **Chrome unpacked:** replace the extracted folder, then press **Reload** on the
  extension card in `chrome://extensions`.
- **Firefox temporary:** load the new `manifest.json` again from
  `about:debugging`; the previous temporary version is replaced.
- **Store installs:** update normally through the browser.

The version shown in the popup identifies the build. Chrome builds show
`v<version>.<sha>` and link to the commit; Firefox builds show `v<version>`
because AMO rebuilds the source and requires reproducible output. Release tags
and zip filenames always include the commit.

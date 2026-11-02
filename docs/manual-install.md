# Install from a GitHub release or build it yourself

The normal install paths are the browser stores:

- **Chrome, Edge, Brave:** [Chrome Web Store](https://chromewebstore.google.com/detail/uvs-ultra-deck-prices/oheojpdmolhnhlojoojnkgpnadnanljd)
- **Firefox:** [Firefox Add-ons](https://addons.mozilla.org/firefox/) — the
  listing is in review. Until it is approved, use the GitHub zip below.

These instructions are for people who want the exact build attached to a GitHub
release, or who want to build from source. You do not need to install Node.js or
any developer tools to use a release zip.

## From a GitHub release

Open the [latest release](https://github.com/tressero/uvs-ultra-prices-plugin/releases/latest)
and download the archive for your browser:

| Browser | Release asset | Install method |
| --- | --- | --- |
| Chrome, Edge, Brave | `dist-<version>.<sha>.zip` | Extract, then **Load unpacked** |
| Firefox | `dist-firefox-<version>.<sha>.zip` | Extract, then **Load Temporary Add-on** |

Ignore `uvs-ultra-prices-source-<version>.<sha>.zip`; that archive is only for
store reviewers. Releases before Firefox support have no `dist-firefox-` zip.
If the newest release does not include one, use the newest release that does, or
build from source below.

The browser loads the extracted folder, not the zip file. Keep the folder where
it is after installing.

### Chrome, Edge and Brave

1. Extract the zip to a folder you will keep.
   - **Windows:** right-click the zip → **Extract All…**.
   - **macOS:** double-click the zip.
2. Open `chrome://extensions`. In Edge, use `edge://extensions`; in Brave, use
   `brave://extensions`.
3. Turn on **Developer mode** (top right in Chrome, left sidebar in Edge).
4. Click **Load unpacked** and select the extracted folder — the one that
   contains `manifest.json`.
5. Open a deck on <https://uvsultra.online>.

Chrome may show a notice about developer-mode extensions when it starts. Keep
them enabled if asked. It remains installed until you remove it or turn developer
mode off. Some managed browsers block developer mode entirely.

### Firefox

1. Extract the zip to a folder you will keep.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `manifest.json` inside the extracted folder — not the zip.
5. Open a deck on <https://uvsultra.online>.

Firefox removes temporary add-ons when it restarts. Load `manifest.json` again
after a restart, or install from [Firefox Add-ons](https://addons.mozilla.org/firefox/)
once the listing is live. The GitHub zip is unsigned; standard Firefox will not
install it permanently. A permanent install needs the signed store build.

### Updating a zip install

1. Download the newer release and extract it over the same folder.
2. **Chrome / Edge:** open `chrome://extensions` and click **Reload** on the
   extension card.
3. **Firefox:** open `about:debugging#/runtime/this-firefox` and load
   `manifest.json` again.

Store installs update automatically; there is nothing to do after the first
install.

### If something does not work

| Problem | What to do |
| --- | --- |
| **Load unpacked** is missing or greyed out | Turn on **Developer mode** on `chrome://extensions`. |
| Chrome says “Manifest file is missing or unreadable” | You selected the wrong folder. Select the folder that has `manifest.json` directly inside it; extraction sometimes creates a nested folder. |
| Firefox will not accept the file | Choose `manifest.json` from inside the extracted folder, not the zip file. |
| The add-on disappeared after restarting Firefox | Temporary add-ons are removed on restart. Load `manifest.json` again, or wait for the Firefox Add-ons listing. |
| No prices appear on UVS Ultra | Check that the extension is enabled, then reload the UVS Ultra tab. The extension only runs on <https://uvsultra.online>. |
| A card shows `n/a` | TCGplayer has no matching product or no price for that card. See [Known limits](../README.md#known-limits). |

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

The version shown in the popup identifies the build. Chrome builds show
`v<version>.<sha>` and link to the commit; Firefox builds show `v<version>`
because AMO rebuilds the source and requires reproducible output. Release tags
and zip filenames always include the commit.

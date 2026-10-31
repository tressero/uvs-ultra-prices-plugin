/** User settings, persisted in chrome.storage.local. */
import { DEFAULT_METRIC, normalizeMetric } from '../../../shared/metrics.js';

export const DEFAULTS = {
  /** 'mid' | 'market' | 'low' — which TCGplayer number drives the total. */
  metric: DEFAULT_METRIC,
  /** Show rows with no match as "n/a" (dashed outline) instead of hiding them. */
  showUnmatched: true,
  /** Pricing worker base URL; empty means "use the URL baked in at build time". */
  workerUrl: '',
};

export async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    return { ...DEFAULTS, ...stored, metric: normalizeMetric(stored.metric) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function onSettingsChanged(callback) {
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const [key, value] of Object.entries(changes)) patch[key] = value.newValue;
      if (Object.keys(patch).length) callback(patch);
    });
  } catch {
    /* not running as an extension */
  }
}

export async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

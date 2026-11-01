/** Popup: settings, the state of the pricing service, and the build version. */
import { DEFAULT_METRIC, normalizeMetric } from '../../../shared/metrics.js';

const METRIC_KEY = 'metric';
const UNMATCHED_KEY = 'showUnmatched';

// Baked in by build.mjs. The typeof guards keep the file usable unbundled.
const APP_VERSION_LABEL = typeof __APP_VERSION_LABEL__ !== 'undefined' ? __APP_VERSION_LABEL__ : 'dev';
const GIT_COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown';
const GIT_COMMIT_URL = typeof __GIT_COMMIT_URL__ !== 'undefined' ? __GIT_COMMIT_URL__ : '';

function $(selector) {
  return document.querySelector(selector);
}

async function send(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url || 'not configured';
  }
}

function renderVersion() {
  const link = $('#app-version');
  if (!link) return;
  link.textContent = `v${APP_VERSION_LABEL}`;
  link.title = GIT_COMMIT ? `Built from commit ${GIT_COMMIT}` : `Version ${APP_VERSION_LABEL}`;
  if (GIT_COMMIT_URL) link.href = GIT_COMMIT_URL;
  else link.removeAttribute('href');
}

async function render() {
  const settings = await chrome.storage.local.get({
    metric: DEFAULT_METRIC,
    showUnmatched: true,
  });
  $('#metric').value = normalizeMetric(settings.metric);
  $('#show-unmatched').checked = Boolean(settings.showUnmatched);

  const status = await send({ type: 'service-status' });
  const line = $('#service-state');
  const detail = $('#service-detail');

  if (!status) {
    line.textContent = 'Extension not responding';
    line.className = 'popup-state popup-state--bad';
    return;
  }

  $('#service-host').textContent = hostOf(status.workerUrl);

  if (status.ok) {
    line.textContent = 'Live';
    line.className = 'popup-state popup-state--ok';
    const updated = status.updatedAt ? new Date(status.updatedAt) : null;
    detail.textContent = [
      `${Number(status.products ?? 0).toLocaleString()} prices`,
      `${status.sets ?? 0} sets`,
      updated ? `synced ${updated.toISOString().slice(0, 10)}` : 'never synced',
    ].join(' · ');
  } else {
    line.textContent = 'Unreachable';
    line.className = 'popup-state popup-state--bad';
    detail.textContent = status.error ?? 'no response from the pricing service';
  }
}

function flashSaved() {
  const saved = $('#saved');
  saved.classList.add('popup-saved--visible');
  clearTimeout(flashSaved.timer);
  flashSaved.timer = setTimeout(() => saved.classList.remove('popup-saved--visible'), 900);
}

$('#metric').addEventListener('change', async (event) => {
  await chrome.storage.local.set({ [METRIC_KEY]: normalizeMetric(event.target.value) });
  flashSaved();
});

$('#show-unmatched').addEventListener('change', async (event) => {
  await chrome.storage.local.set({ [UNMATCHED_KEY]: event.target.checked });
  flashSaved();
});

renderVersion();
render();

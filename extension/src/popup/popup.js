/** Popup: settings and the state of the pricing service. */

const METRIC_KEY = 'metric';
const UNMATCHED_KEY = 'showUnmatched';

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

async function render() {
  const settings = await chrome.storage.local.get({ metric: 'market', showUnmatched: true });
  for (const input of document.querySelectorAll('input[name="metric"]')) {
    input.checked = input.value === settings.metric;
  }
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

for (const input of document.querySelectorAll('input[name="metric"]')) {
  input.addEventListener('change', async () => {
    if (!input.checked) return;
    await chrome.storage.local.set({ [METRIC_KEY]: input.value });
    flashSaved();
  });
}

$('#show-unmatched').addEventListener('change', async (event) => {
  await chrome.storage.local.set({ [UNMATCHED_KEY]: event.target.checked });
  flashSaved();
});

render();

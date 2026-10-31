/** Popup: settings and the state of the price data. */

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

async function render() {
  const settings = await chrome.storage.local.get({ metric: 'market', showUnmatched: true });
  for (const input of document.querySelectorAll('input[name="metric"]')) {
    input.checked = input.value === settings.metric;
  }
  $('#show-unmatched').checked = Boolean(settings.showUnmatched);

  const info = await send({ type: 'catalog-info' });
  const status = $('#status');
  if (info?.ok && info.updatedAt) {
    status.textContent = `${info.products.toLocaleString()} TCGplayer listings · updated ${info.updatedAt}`;
    status.classList.add('popup-status--ok');
  } else {
    status.textContent = 'No price data loaded';
    status.classList.add('popup-status--warn');
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

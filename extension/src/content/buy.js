/**
 * The deck's "Buy on TCGplayer" flow.
 *
 * Mass Entry can only add cards TCGplayer has a product for. Before opening it
 * we list every card that has no real price, say why, and then send only the
 * priced cards. The modal is ours (not Bootstrap) so it works even if the site
 * changes its dialog library.
 */
import { buildMassEntryUrl, selectForMassEntry } from '../../../shared/massentry.js';
import { REASON_TEXT } from './chip.js';

const MODAL_ID = 'uvsp-buy-modal';

function copiesOf(items) {
  return items.reduce((sum, item) => sum + (Number(item.card?.qty) || 1), 0);
}

function reasonFor(item) {
  return REASON_TEXT[item.reason] ?? 'No TCGplayer price';
}

function openMassEntry(items) {
  const url = buildMassEntryUrl(items);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function closeModal() {
  document.getElementById(MODAL_ID)?.remove();
  document.removeEventListener('keydown', onKeyDown, true);
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  }
}

function showModal(included, excluded) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.className = 'uvsp-buy-modal';

  const dialog = document.createElement('div');
  dialog.className = 'uvsp-buy-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'uvsp-buy-title');

  const title = document.createElement('h2');
  title.id = 'uvsp-buy-title';
  title.className = 'uvsp-buy-title';
  title.textContent =
    excluded.length === 1 ? '1 card won’t be added' : `${excluded.length} cards won’t be added`;

  const intro = document.createElement('p');
  intro.className = 'uvsp-buy-intro';
  intro.textContent =
    'TCGplayer has no price for these cards yet, so they won’t be added to Mass Entry.';

  const list = document.createElement('ul');
  list.className = 'uvsp-buy-list';
  for (const item of excluded) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'uvsp-buy-card';
    name.textContent = `${Number(item.card?.qty) || 1}× ${item.card?.name ?? 'Unknown card'}`;
    const reason = document.createElement('span');
    reason.className = 'uvsp-buy-reason';
    reason.textContent = reasonFor(item);
    row.append(name, reason);
    list.append(row);
  }

  const summary = document.createElement('p');
  summary.className = 'uvsp-buy-summary';
  const includedCopies = copiesOf(included);
  const excludedCopies = copiesOf(excluded);
  summary.textContent = includedCopies
    ? `Continuing with ${includedCopies} of ${includedCopies + excludedCopies} cards.`
    : 'None of this deck’s cards has a TCGplayer price yet.';

  const actions = document.createElement('div');
  actions.className = 'uvsp-buy-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'uvsp-buy-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', closeModal);

  actions.append(cancel);

  if (includedCopies) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'uvsp-buy-go';
    go.textContent = `Open Mass Entry (${includedCopies} cards)`;
    go.addEventListener('click', () => {
      if (openMassEntry(included)) closeModal();
    });
    actions.append(go);
    setTimeout(() => go.focus(), 0);
  } else {
    setTimeout(() => cancel.focus(), 0);
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  dialog.append(title, intro, list, summary, actions);
  overlay.append(dialog);
  document.body.append(overlay);
  document.addEventListener('keydown', onKeyDown, true);
}

/**
 * Open Mass Entry with the cards that have a price. Cards without one are shown
 * first, so the user knows what is missing before TCGplayer opens.
 */
export function startBuyFlow(items) {
  if (!items?.length) return;
  const { included, excluded } = selectForMassEntry(items);
  if (!included.length) {
    showModal([], excluded);
    return;
  }
  if (!excluded.length) {
    openMassEntry(included);
    return;
  }
  showModal(included, excluded);
}

import { emit } from '../core/events.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import {
  fetchSellListings,
  fetchBuyOffers,
  createSellListing,
  createBuyOffer,
  buyFromListing,
  fillBuyOffer,
  applyServerSave,
  syncMarketEconomy,
  fetchMyListings,
  cancelSellListing,
  cancelBuyOffer,
  calcMarketFee,
  subscribeMarketChanges,
  unsubscribeMarketChanges,
} from '../systems/marketP2p.js';
import { renderReportPlayerForm } from './adminView.js';
import { getAuthState } from '../core/auth.js';

function formatNumber(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

let p2pSubTab = 'browse_sell';
let marketUnsub = null;
let p2pPanelGame = null;
let p2pPanelContainer = null;

function tradableResources(game) {
  return Object.entries(game.resources)
    .filter(([, r]) => r.job && !r.combatOnly && !r.merchantOnly);
}

function resourceLabel(game, resourceId) {
  const r = game.resources[resourceId];
  return r ? `${renderResourceIcon(r, 'hdv-row-icon')} ${r.name}` : resourceId;
}

function notify(msg) {
  emit('farmBlocked', { message: msg });
}

async function refreshP2pPanel() {
  if (p2pPanelGame && p2pPanelContainer) {
    await renderMarketP2pPanel(p2pPanelGame, p2pPanelContainer, { keepSubTab: true });
  }
}

export async function renderMarketP2pPanel(game, container, { keepSubTab = false } = {}) {
  p2pPanelGame = game;
  p2pPanelContainer = container;

  if (!keepSubTab) p2pSubTab = 'browse_sell';

  if (marketUnsub) {
    marketUnsub();
    marketUnsub = null;
  }

  container.innerHTML = '<p class="view-desc hdv-p2p-loading">Chargement du marché joueurs…</p>';

  const [sells, buys, mine] = await Promise.all([
    fetchSellListings(),
    fetchBuyOffers(),
    fetchMyListings(),
  ]);

  const subTabs = [
    { id: 'browse_sell', label: '🛒 Acheter' },
    { id: 'browse_buy', label: '🔍 Recherches' },
    { id: 'sell', label: '📤 Vendre' },
    { id: 'buy_offer', label: '📥 Proposer achat' },
    { id: 'mine', label: '📋 Mes annonces' },
  ];

  container.innerHTML = `
    <div class="hdv-p2p-header">
      <p class="hdv-p2p-desc">Échanges instantanés entre joueurs. Frais plateforme : 5 % · Durée 72 h</p>
    </div>
    <nav class="hdv-p2p-tabs" aria-label="HDV joueur">
      ${subTabs.map((t) => `<button type="button" class="hdv-p2p-tab${p2pSubTab === t.id ? ' active' : ''}" data-p2p-tab="${t.id}">${t.label}</button>`).join('')}
    </nav>
    <div id="hdv-p2p-report-root"></div>
    <div class="hdv-p2p-body" id="hdv-p2p-body"></div>
  `;

  container.querySelectorAll('[data-p2p-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      p2pSubTab = btn.dataset.p2pTab;
      renderMarketP2pPanel(game, container, { keepSubTab: true });
    });
  });

  marketUnsub = await subscribeMarketChanges(game, () => refreshP2pPanel());

  const body = container.querySelector('#hdv-p2p-body');
  const myId = getAuthState().userId;

  if (p2pSubTab === 'browse_sell') {
    if (!sells.ok) {
      body.innerHTML = `<p class="auth-error">${sells.reason}</p>`;
      return;
    }
    body.innerHTML = sells.rows.length
      ? sells.rows.map((row) => {
        const total = row.unit_price * row.qty_remaining;
        const isMine = row.seller_id === myId;
        return `
        <div class="hdv-p2p-row${isMine ? ' hdv-p2p-row-mine' : ''}" data-listing-row="${row.id}">
          <div class="hdv-p2p-row-main">
            <span class="hdv-p2p-res">${resourceLabel(game, row.resource_id)}</span>
            <span class="hdv-p2p-meta">×${row.qty_remaining} · ${row.unit_price} 💰/u · <strong>${formatNumber(total)}</strong> 💰</span>
            <span class="hdv-p2p-seller">${isMine ? 'Toi' : row.seller_name || '?'}
              ${!isMine && row.seller_id ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.seller_id}" data-name="${row.seller_name || 'Vendeur'}">🚩</button>` : ''}
            </span>
          </div>
          ${isMine ? '<span class="hdv-p2p-badge">Ton annonce</span>' : `
          <div class="hdv-p2p-actions">
            <button type="button" class="btn btn-small" data-buy-qty="1" data-listing="${row.id}" data-max="${row.qty_remaining}" data-price="${row.unit_price}" data-res="${row.resource_id}">×1</button>
            ${row.qty_remaining > 1 ? `<button type="button" class="btn btn-small btn-craft" data-buy-qty="${row.qty_remaining}" data-listing="${row.id}" data-max="${row.qty_remaining}" data-price="${row.unit_price}" data-res="${row.resource_id}">Tout (×${row.qty_remaining})</button>` : ''}
          </div>`}
        </div>`;
      }).join('')
      : '<p class="view-desc">Aucune vente pour l’instant. Publie la tienne dans « Vendre ».</p>';

    body.querySelectorAll('.p2p-report-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const root = document.getElementById('hdv-p2p-report-root');
        if (root) renderReportPlayerForm(root, btn.dataset.uid, btn.dataset.name);
      });
    });

    body.querySelectorAll('[data-buy-qty]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qty = Math.min(Number(btn.dataset.buyQty) || 1, Number(btn.dataset.max) || 1);
        const listingId = btn.dataset.listing;
        const row = btn.closest('[data-listing-row]');
        btn.disabled = true;
        await game.flushSave?.();
        const r = await buyFromListing(listingId, qty);
        if (!r.ok) {
          btn.disabled = false;
          notify(r.reason || 'Achat impossible.');
          return;
        }
        applyServerSave(game, r.result?.save);
        await syncMarketEconomy(game);
        const resName = game.resources[r.result?.resource_id]?.name || r.result?.resource_id;
        notify(`Acheté ${resName} ×${qty} pour ${formatNumber(r.result?.total)} 💰`);
        if (row) row.remove();
        if (!body.querySelector('[data-listing-row]')) {
          body.innerHTML = '<p class="view-desc">Aucune vente pour l’instant.</p>';
        }
        emit('stateChange', game.state, { kind: 'auction' });
      });
    });
    return;
  }

  if (p2pSubTab === 'browse_buy') {
    if (!buys.ok) {
      body.innerHTML = `<p class="auth-error">${buys.reason}</p>`;
      return;
    }
    body.innerHTML = buys.rows.length
      ? buys.rows.map((row) => {
        const isMine = row.buyer_id === myId;
        const have = game.state.inventory?.[row.resource_id] || 0;
        const canFill = !isMine && have > 0;
        const fillQty = Math.min(have, row.qty_remaining);
        return `
        <div class="hdv-p2p-row${isMine ? ' hdv-p2p-row-mine' : ''}" data-offer-row="${row.id}">
          <div class="hdv-p2p-row-main">
            <span class="hdv-p2p-res">${resourceLabel(game, row.resource_id)}</span>
            <span class="hdv-p2p-meta">cherche ×${row.qty_remaining} · max ${row.max_unit_price} 💰/u</span>
            <span class="hdv-p2p-seller">${isMine ? 'Toi' : row.buyer_name || '?'}
              ${!isMine && row.buyer_id ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.buyer_id}" data-name="${row.buyer_name || 'Acheteur'}">🚩</button>` : ''}
            </span>
          </div>
          ${isMine ? '<span class="hdv-p2p-badge">Ta recherche</span>' : canFill ? `
          <div class="hdv-p2p-actions">
            <button type="button" class="btn btn-small btn-craft" data-fill-offer="${row.id}" data-qty="${fillQty}" data-res="${row.resource_id}">Vendre ×${fillQty}</button>
          </div>` : '<span class="hdv-p2p-badge warn">Stock insuffisant</span>'}
        </div>`;
      }).join('')
      : '<p class="view-desc">Aucune recherche pour l’instant.</p>';

    body.querySelectorAll('.p2p-report-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const root = document.getElementById('hdv-p2p-report-root');
        if (root) renderReportPlayerForm(root, btn.dataset.uid, btn.dataset.name);
      });
    });

    body.querySelectorAll('[data-fill-offer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qty = Number(btn.dataset.qty) || 1;
        const offerId = btn.dataset.fillOffer;
        const row = btn.closest('[data-offer-row]');
        btn.disabled = true;
        await game.flushSave?.();
        const r = await fillBuyOffer(offerId, qty);
        if (!r.ok) {
          btn.disabled = false;
          notify(r.reason || 'Vente impossible.');
          return;
        }
        applyServerSave(game, r.result?.save);
        await syncMarketEconomy(game);
        const net = (r.result?.net ?? r.result?.payout - r.result?.fee) || 0;
        notify(`Vendu ×${qty} · +${formatNumber(net)} 💰 (frais ${formatNumber(r.result?.fee || 0)} 💰)`);
        if (row) row.remove();
        emit('stateChange', game.state, { kind: 'auction' });
      });
    });
    return;
  }

  if (p2pSubTab === 'sell') {
    const resourceOptions = tradableResources(game)
      .map(([id, r]) => `<option value="${id}">${r.name} (×${game.state.inventory?.[id] || 0})</option>`)
      .join('');
    body.innerHTML = `
      <p class="view-desc">Les ressources sont retirées de ton inventaire dès la publication.</p>
      <label class="auth-label">Ressource</label>
      <select class="auth-input" id="p2p-sell-resource">${resourceOptions}</select>
      <label class="auth-label">Quantité</label>
      <input type="number" class="auth-input" id="p2p-sell-qty" min="1" value="1" />
      <label class="auth-label">Prix unitaire (💰)</label>
      <input type="number" class="auth-input" id="p2p-sell-price" min="1" value="10" />
      <button type="button" class="btn btn-craft" id="p2p-sell-submit">Publier vente</button>
    `;
    const qtyInput = body.querySelector('#p2p-sell-qty');
    const resSelect = body.querySelector('#p2p-sell-resource');
    const syncMax = () => {
      const have = game.state.inventory?.[resSelect?.value] || 0;
      if (qtyInput) {
        qtyInput.max = have;
        if (Number(qtyInput.value) > have) qtyInput.value = Math.max(1, have);
      }
    };
    resSelect?.addEventListener('change', syncMax);
    syncMax();

    body.querySelector('#p2p-sell-submit')?.addEventListener('click', async () => {
      const resourceId = resSelect?.value;
      const qty = Number(qtyInput?.value) || 1;
      const unitPrice = Number(body.querySelector('#p2p-sell-price')?.value) || 1;
      const have = game.state.inventory?.[resourceId] || 0;
      if (have < qty) {
        notify(`Stock insuffisant (×${have}).`);
        return;
      }
      const btn = body.querySelector('#p2p-sell-submit');
      btn.disabled = true;
      await game.flushSave?.();
      const r = await createSellListing({
        resourceId,
        qty,
        unitPrice,
        sellerDisplayName: game.getCharacterDisplayName(),
      });
      if (!r.ok) {
        btn.disabled = false;
        notify(r.reason || 'Publication impossible.');
        return;
      }
      applyServerSave(game, r.save);
      await syncMarketEconomy(game);
      notify('Annonce publiée — ressources réservées.');
      p2pSubTab = 'mine';
      renderMarketP2pPanel(game, container, { keepSubTab: true });
    });
    return;
  }

  if (p2pSubTab === 'buy_offer') {
    const resourceOptions = tradableResources(game)
      .map(([id, r]) => `<option value="${id}">${r.name}</option>`)
      .join('');
    body.innerHTML = `
      <label class="auth-label">Ressource recherchée</label>
      <select class="auth-input" id="p2p-buy-resource">${resourceOptions}</select>
      <label class="auth-label">Quantité</label>
      <input type="number" class="auth-input" id="p2p-buy-qty" min="1" value="1" />
      <label class="auth-label">Prix max / unité (💰)</label>
      <input type="number" class="auth-input" id="p2p-buy-price" min="1" value="10" />
      <p class="view-desc" id="p2p-buy-total">Total réservé : 10 💰</p>
      <button type="button" class="btn btn-craft" id="p2p-buy-submit">Publier recherche</button>
    `;
    const updateTotal = () => {
      const qty = Number(body.querySelector('#p2p-buy-qty')?.value) || 1;
      const price = Number(body.querySelector('#p2p-buy-price')?.value) || 1;
      const total = qty * price;
      const el = body.querySelector('#p2p-buy-total');
      if (el) el.textContent = `Total réservé : ${formatNumber(total)} 💰`;
    };
    body.querySelector('#p2p-buy-qty')?.addEventListener('input', updateTotal);
    body.querySelector('#p2p-buy-price')?.addEventListener('input', updateTotal);
    updateTotal();

    body.querySelector('#p2p-buy-submit')?.addEventListener('click', async () => {
      const resourceId = body.querySelector('#p2p-buy-resource')?.value;
      const qty = Number(body.querySelector('#p2p-buy-qty')?.value) || 1;
      const maxUnitPrice = Number(body.querySelector('#p2p-buy-price')?.value) || 1;
      const total = qty * maxUnitPrice;
      if ((game.state.kirha || 0) < total) {
        notify(`Il faut ${formatNumber(total)} 💰 en escrow.`);
        return;
      }
      const btn = body.querySelector('#p2p-buy-submit');
      btn.disabled = true;
      await game.flushSave?.();
      const r = await createBuyOffer({
        resourceId,
        qty,
        maxUnitPrice,
        buyerDisplayName: game.getCharacterDisplayName(),
      });
      if (!r.ok) {
        btn.disabled = false;
        notify(r.reason || 'Publication impossible.');
        return;
      }
      applyServerSave(game, r.save);
      await syncMarketEconomy(game);
      notify('Recherche publiée — Kirha réservés.');
      p2pSubTab = 'mine';
      renderMarketP2pPanel(game, container, { keepSubTab: true });
    });
    return;
  }

  if (p2pSubTab === 'mine') {
    body.innerHTML = `
      <h4 class="hdv-p2p-section-title">Mes ventes</h4>
      ${mine.sells.length ? mine.sells.map((r) => `
        <div class="hdv-p2p-row hdv-p2p-row-mine">
          <div class="hdv-p2p-row-main">
            <span>${resourceLabel(game, r.resource_id)}</span>
            <span class="hdv-p2p-meta">×${r.qty_remaining} @ ${r.unit_price} 💰/u</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-sell="${r.id}">Annuler</button>
        </div>
      `).join('') : '<p class="view-desc">Aucune vente active.</p>'}
      <h4 class="hdv-p2p-section-title">Mes recherches</h4>
      ${mine.buys.length ? mine.buys.map((r) => `
        <div class="hdv-p2p-row hdv-p2p-row-mine">
          <div class="hdv-p2p-row-main">
            <span>${resourceLabel(game, r.resource_id)}</span>
            <span class="hdv-p2p-meta">×${r.qty_remaining} max ${r.max_unit_price} 💰/u · ${formatNumber(r.kirha_escrowed)} 💰 bloqués</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-buy="${r.id}">Annuler</button>
        </div>
      `).join('') : '<p class="view-desc">Aucune recherche active.</p>'}
    `;

    body.querySelectorAll('[data-cancel-sell]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const r = await cancelSellListing(btn.dataset.cancelSell);
        if (!r.ok) notify(r.reason || 'Annulation impossible.');
        else {
          applyServerSave(game, r.save);
          await syncMarketEconomy(game);
          notify('Annonce annulée — stock rendu.');
        }
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
    });

    body.querySelectorAll('[data-cancel-buy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const r = await cancelBuyOffer(btn.dataset.cancelBuy);
        if (!r.ok) notify(r.reason || 'Annulation impossible.');
        else {
          applyServerSave(game, r.save);
          await syncMarketEconomy(game);
          notify('Recherche annulée — Kirha rendus.');
        }
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
    });
  }
}

export function teardownMarketP2pPanel() {
  if (marketUnsub) {
    marketUnsub();
    marketUnsub = null;
  }
  unsubscribeMarketChanges();
  p2pPanelGame = null;
  p2pPanelContainer = null;
}

import { emit } from '../core/events.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import {
  fetchSellListings,
  fetchBuyOffers,
  createSellListing,
  createBuyOffer,
  buyFromListing,
  fillBuyOffer,
  applyBuyListingResult,
  applyFillBuyOfferResult,
  fetchMyListings,
  calcMarketFee,
} from '../systems/marketP2p.js';
import { renderReportPlayerForm } from './adminView.js';
import { getAuthState } from '../core/auth.js';

function formatNumber(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

let p2pSubTab = 'browse_sell';

export async function renderMarketP2pPanel(game, container) {
  container.innerHTML = '<p class="view-desc">Chargement du marché joueurs…</p>';

  const [sells, buys, mine] = await Promise.all([
    fetchSellListings(),
    fetchBuyOffers(),
    fetchMyListings(),
  ]);

  const subTabs = [
    { id: 'browse_sell', label: 'Ventes' },
    { id: 'browse_buy', label: 'Recherches' },
    { id: 'sell', label: 'Vendre' },
    { id: 'buy_offer', label: 'Proposer achat' },
    { id: 'mine', label: 'Mes annonces' },
  ];

  container.innerHTML = `
    <nav class="hdv-p2p-tabs">
      ${subTabs.map((t) => `<button type="button" class="hdv-p2p-tab${p2pSubTab === t.id ? ' active' : ''}" data-p2p-tab="${t.id}">${t.label}</button>`).join('')}
    </nav>
    <div id="hdv-p2p-report-root"></div>
    <div class="hdv-p2p-body" id="hdv-p2p-body"></div>
  `;

  container.querySelectorAll('[data-p2p-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      p2pSubTab = btn.dataset.p2pTab;
      renderMarketP2pPanel(game, container);
    });
  });

  const body = container.querySelector('#hdv-p2p-body');

  if (p2pSubTab === 'browse_sell') {
    if (!sells.ok) {
      body.innerHTML = `<p class="auth-error">${sells.reason}</p>`;
      return;
    }
    body.innerHTML = sells.rows.length
      ? sells.rows.map((row) => `
        <div class="hdv-p2p-row">
          <span>${renderResourceIcon(game.resources[row.resource_id], 'hdv-row-icon')} ${game.resources[row.resource_id]?.name || row.resource_id}</span>
          <span>×${row.qty_remaining} · ${row.unit_price} 💰/u · ${row.seller_name || row.profiles?.display_name || '?'}
            ${row.seller_id && row.seller_id !== getAuthState().userId ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.seller_id}" data-name="${row.seller_name || 'Vendeur'}">🚩</button>` : ''}
          </span>
          <button type="button" class="btn btn-small btn-craft" data-buy-listing="${row.id}" data-qty="${row.qty_remaining}">Acheter</button>
        </div>
      `).join('')
      : '<p class="view-desc">Aucune vente pour l’instant.</p>';
    body.querySelectorAll('.p2p-report-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const root = document.getElementById('hdv-p2p-report-root');
        if (root) renderReportPlayerForm(root, btn.dataset.uid, btn.dataset.name);
      });
    });
    body.querySelectorAll('[data-buy-listing]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qty = Math.min(Number(btn.dataset.qty) || 1, 25);
        const r = await buyFromListing(btn.dataset.buyListing, qty);
        if (!r.ok) emit('farmBlocked', { message: r.reason || 'Achat impossible.' });
        else {
          const applied = applyBuyListingResult(game, r.result);
          if (!applied.ok) emit('farmBlocked', { message: applied.reason || 'Achat impossible.' });
          else emit('farmBlocked', { message: `Acheté ×${applied.qty} pour ${formatNumber(applied.total)} 💰` });
          renderMarketP2pPanel(game, container);
        }
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
      ? buys.rows.map((row) => `
        <div class="hdv-p2p-row">
          <span>${game.resources[row.resource_id]?.name || row.resource_id}</span>
          <span>cherche ×${row.qty_remaining} · max ${row.max_unit_price} 💰/u · ${row.buyer_name || '?'}
            ${row.buyer_id && row.buyer_id !== getAuthState().userId ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.buyer_id}" data-name="${row.buyer_name || 'Acheteur'}">🚩</button>` : ''}
          </span>
          <button type="button" class="btn btn-small" data-fill-offer="${row.id}">Vendre</button>
        </div>
      `).join('')
      : '<p class="view-desc">Aucune recherche pour l’instant.</p>';
    body.querySelectorAll('.p2p-report-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const root = document.getElementById('hdv-p2p-report-root');
        if (root) renderReportPlayerForm(root, btn.dataset.uid, btn.dataset.name);
      });
    });
    body.querySelectorAll('[data-fill-offer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const r = await fillBuyOffer(btn.dataset.fillOffer, 1);
        if (!r.ok) emit('farmBlocked', { message: r.reason || 'Vente impossible.' });
        else {
          const applied = applyFillBuyOfferResult(game, r.result);
          if (!applied.ok) emit('farmBlocked', { message: applied.reason || 'Vente impossible.' });
          else emit('farmBlocked', { message: `Vendu ×${applied.qty} · +${formatNumber(applied.payout - applied.fee)} 💰` });
          renderMarketP2pPanel(game, container);
        }
      });
    });
    return;
  }

  if (p2pSubTab === 'sell') {
    const resourceOptions = Object.entries(game.resources)
      .filter(([, r]) => r.job && !r.combatOnly && !r.merchantOnly)
      .map(([id, r]) => `<option value="${id}">${r.name}</option>`)
      .join('');
    body.innerHTML = `
      <p class="view-desc">Frais plateforme : ${Math.round(calcMarketFee(1000) / 10)} % · Durée 72 h</p>
      <label class="auth-label">Ressource</label>
      <select class="auth-input" id="p2p-sell-resource">${resourceOptions}</select>
      <label class="auth-label">Quantité</label>
      <input type="number" class="auth-input" id="p2p-sell-qty" min="1" value="1" />
      <label class="auth-label">Prix unitaire (💰)</label>
      <input type="number" class="auth-input" id="p2p-sell-price" min="1" value="10" />
      <button type="button" class="btn btn-craft" id="p2p-sell-submit">Publier vente</button>
    `;
    body.querySelector('#p2p-sell-submit')?.addEventListener('click', async () => {
      const resourceId = body.querySelector('#p2p-sell-resource')?.value;
      const qty = Number(body.querySelector('#p2p-sell-qty')?.value) || 1;
      const unitPrice = Number(body.querySelector('#p2p-sell-price')?.value) || 1;
      const have = game.state.inventory?.[resourceId] || 0;
      if (have < qty) {
        emit('farmBlocked', { message: `Stock insuffisant (×${have}).` });
        return;
      }
      const r = await createSellListing({
        resourceId,
        qty,
        unitPrice,
        sellerDisplayName: game.getCharacterDisplayName(),
      });
      if (!r.ok) emit('farmBlocked', { message: r.reason || 'Publication impossible.' });
      else {
        game.state.inventory[resourceId] = have - qty;
        if (game.state.inventory[resourceId] <= 0) delete game.state.inventory[resourceId];
        game.scheduleSave();
        emit('farmBlocked', { message: 'Annonce publiée !' });
        p2pSubTab = 'mine';
        renderMarketP2pPanel(game, container);
      }
    });
    return;
  }

  if (p2pSubTab === 'buy_offer') {
    const resourceOptions = Object.entries(game.resources)
      .filter(([, r]) => r.job && !r.combatOnly && !r.merchantOnly)
      .map(([id, r]) => `<option value="${id}">${r.name}</option>`)
      .join('');
    body.innerHTML = `
      <label class="auth-label">Ressource recherchée</label>
      <select class="auth-input" id="p2p-buy-resource">${resourceOptions}</select>
      <label class="auth-label">Quantité</label>
      <input type="number" class="auth-input" id="p2p-buy-qty" min="1" value="1" />
      <label class="auth-label">Prix max / unité (💰)</label>
      <input type="number" class="auth-input" id="p2p-buy-price" min="1" value="10" />
      <p class="view-desc">Les Kirha seront réservés (escrow) à la publication.</p>
      <button type="button" class="btn btn-craft" id="p2p-buy-submit">Publier recherche</button>
    `;
    body.querySelector('#p2p-buy-submit')?.addEventListener('click', async () => {
      const resourceId = body.querySelector('#p2p-buy-resource')?.value;
      const qty = Number(body.querySelector('#p2p-buy-qty')?.value) || 1;
      const maxUnitPrice = Number(body.querySelector('#p2p-buy-price')?.value) || 1;
      const total = qty * maxUnitPrice;
      if ((game.state.kirha || 0) < total) {
        emit('farmBlocked', { message: `Il faut ${formatNumber(total)} 💰 en escrow.` });
        return;
      }
      const r = await createBuyOffer({
        resourceId,
        qty,
        maxUnitPrice,
        buyerDisplayName: game.getCharacterDisplayName(),
      });
      if (!r.ok) emit('farmBlocked', { message: r.reason || 'Publication impossible.' });
      else {
        game.state.kirha -= total;
        game.scheduleSave();
        p2pSubTab = 'mine';
        renderMarketP2pPanel(game, container);
      }
    });
    return;
  }

  if (p2pSubTab === 'mine') {
    body.innerHTML = `
      <h4>Mes ventes</h4>
      ${mine.sells.length ? mine.sells.map((r) => `<p class="view-desc">${r.resource_id} ×${r.qty_remaining} @ ${r.unit_price} 💰</p>`).join('') : '<p class="view-desc">Aucune.</p>'}
      <h4>Mes recherches</h4>
      ${mine.buys.length ? mine.buys.map((r) => `<p class="view-desc">${r.resource_id} ×${r.qty_remaining} max ${r.max_unit_price} 💰</p>`).join('') : '<p class="view-desc">Aucune.</p>'}
    `;
  }
}

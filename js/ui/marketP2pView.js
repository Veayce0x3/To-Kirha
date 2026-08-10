import { emit } from '../core/events.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';
import { resolveItem } from '../systems/combat.js';
import { RARITY_EMOJI, getInstanceRarity } from '../systems/equipmentRarity.js';
import {
  fetchSellListings,
  fetchBuyOffers,
  createSellListing,
  createBuyOffer,
  createCombatSellListing,
  createCombatBuyOffer,
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
let p2pSellMode = 'resource';
let p2pBuyOfferMode = 'resource';
let marketUnsub = null;
let p2pPanelGame = null;
let p2pPanelContainer = null;

function tradableResources(game) {
  return Object.entries(game.resources)
    .filter(([, r]) => r.job && !r.combatOnly && !r.merchantOnly);
}

function getMarketableCombatItems(game) {
  return game.getOwnedCombatItems().map((ref) => {
    const inst = game.state.combatItemInstances?.find((i) => i.instanceId === ref);
    const item = resolveItem(game.state, ref, game.combatEquipment.items);
    if (!item) return null;
    return {
      ref,
      inst,
      itemId: inst?.itemId || item.id,
      item,
      rarity: getInstanceRarity(inst),
      npcPrice: game.getCombatItemSellPrice(ref),
    };
  }).filter(Boolean);
}

function getCombatCatalog(game) {
  const seen = new Set();
  const rows = [];
  for (const item of Object.values(game.combatEquipment?.items || {})) {
    if (!item?.id || item.companionOnly || seen.has(item.id)) continue;
    seen.add(item.id);
    rows.push(item);
  }
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
}

function ownedCombatInstancesForItem(game, itemId) {
  return getMarketableCombatItems(game).filter((e) => e.itemId === itemId);
}

function combatListingLabel(game, row) {
  const inst = row.combat_instance;
  const itemId = inst?.itemId || row.resource_id;
  const item = game.combatEquipment?.items?.[itemId];
  if (!item) return `⚔️ ${itemId}`;
  const rarity = getInstanceRarity(inst);
  const stats = item.stats
    ? [item.stats.hp ? `+${item.stats.hp} PV` : '', item.stats.atk ? `+${item.stats.atk} ATQ` : '', item.stats.def ? `+${item.stats.def} DEF` : ''].filter(Boolean).join(' · ')
    : '';
  return `${item.emoji || '⚔️'} ${item.name} ${RARITY_EMOJI[rarity] || ''}${stats ? ` · ${stats}` : ''}`;
}

function combatItemOptionLabel(game, entry) {
  const stats = entry.item.stats
    ? [entry.item.stats.atk ? `+${entry.item.stats.atk} ATQ` : '', entry.item.stats.def ? `+${entry.item.stats.def} DEF` : '', entry.item.stats.hp ? `+${entry.item.stats.hp} PV` : ''].filter(Boolean).join(' · ')
    : '';
  return `${entry.item.emoji || '⚔️'} ${entry.item.name} ${RARITY_EMOJI[entry.rarity] || ''}${stats ? ` (${stats})` : ''} — revente PNJ ${entry.npcPrice} 💰`;
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
      <p class="hdv-p2p-desc">Échanges instantanés entre joueurs — ressources, équipement et armes. Frais plateforme : 5 % · Durée 72 h</p>
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
    if (!sells.rows.length) {
      body.innerHTML = '<p class="view-desc">Aucune vente pour l’instant. Publie la tienne dans « Vendre ».</p>';
      return;
    }

    const resourceRows = sells.rows.filter((r) => (r.listing_kind || 'resource') !== 'combat');
    const combatRows = sells.rows.filter((r) => r.listing_kind === 'combat');
    const renderResourceRow = (row) => {
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
    };
    const renderCombatRow = (row) => {
      const isMine = row.seller_id === myId;
      return `
        <div class="hdv-p2p-row hdv-p2p-row-combat${isMine ? ' hdv-p2p-row-mine' : ''}" data-listing-row="${row.id}">
          <div class="hdv-p2p-row-main">
            <span class="hdv-p2p-res">${combatListingLabel(game, row)}</span>
            <span class="hdv-p2p-meta"><strong>${formatNumber(row.unit_price)}</strong> 💰 · frais vendeur 5 %</span>
            <span class="hdv-p2p-seller">${isMine ? 'Toi' : row.seller_name || '?'}
              ${!isMine && row.seller_id ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.seller_id}" data-name="${row.seller_name || 'Vendeur'}">🚩</button>` : ''}
            </span>
          </div>
          ${isMine ? '<span class="hdv-p2p-badge">Ton annonce</span>' : `
          <div class="hdv-p2p-actions">
            <button type="button" class="btn btn-small btn-craft" data-buy-qty="1" data-listing="${row.id}" data-max="1" data-price="${row.unit_price}" data-res="${row.resource_id}" data-combat="1">Acheter</button>
          </div>`}
        </div>`;
    };

    body.innerHTML = `
      ${combatRows.length ? `<h4 class="hdv-p2p-section-title">Équipement & armes</h4>${combatRows.map(renderCombatRow).join('')}` : ''}
      ${resourceRows.length ? `<h4 class="hdv-p2p-section-title">Ressources</h4>${resourceRows.map(renderResourceRow).join('')}` : ''}
    `;

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
        const isCombat = btn.dataset.combat === '1' || r.result?.listing_kind === 'combat';
        const resName = isCombat
          ? combatListingLabel(game, { resource_id: r.result?.resource_id, combat_instance: r.result?.combat_instance })
          : (game.resources[r.result?.resource_id]?.name || r.result?.resource_id);
        notify(isCombat
          ? `Acheté : ${resName} pour ${formatNumber(r.result?.total)} 💰`
          : `Acheté ${resName} ×${qty} pour ${formatNumber(r.result?.total)} 💰`);
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
    if (!buys.rows.length) {
      body.innerHTML = '<p class="view-desc">Aucune recherche pour l’instant.</p>';
      return;
    }

    const resourceRows = buys.rows.filter((r) => (r.listing_kind || 'resource') !== 'combat');
    const combatRows = buys.rows.filter((r) => r.listing_kind === 'combat');

    const renderResourceOffer = (row) => {
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
    };

    const renderCombatOffer = (row) => {
      const isMine = row.buyer_id === myId;
      const itemId = row.combat_item_id || row.resource_id;
      const item = game.combatEquipment?.items?.[itemId];
      const owned = ownedCombatInstancesForItem(game, itemId);
      const canFill = !isMine && owned.length > 0;
      const label = item ? `${item.emoji || '⚔️'} ${item.name}` : itemId;
      return `
        <div class="hdv-p2p-row hdv-p2p-row-combat${isMine ? ' hdv-p2p-row-mine' : ''}" data-offer-row="${row.id}" data-combat-item="${itemId}">
          <div class="hdv-p2p-row-main">
            <span class="hdv-p2p-res">${label}</span>
            <span class="hdv-p2p-meta">cherche ×${row.qty_remaining} · max ${row.max_unit_price} 💰/pièce</span>
            <span class="hdv-p2p-seller">${isMine ? 'Toi' : row.buyer_name || '?'}
              ${!isMine && row.buyer_id ? `<button type="button" class="link-btn p2p-report-btn" data-uid="${row.buyer_id}" data-name="${row.buyer_name || 'Acheteur'}">🚩</button>` : ''}
            </span>
          </div>
          ${isMine ? '<span class="hdv-p2p-badge">Ta recherche</span>' : canFill ? `
          <div class="hdv-p2p-actions hdv-p2p-actions-combat">
            <select class="auth-input hdv-p2p-instance-pick" data-offer-instance="${row.id}">
              ${owned.map((e) => `<option value="${e.ref}">${combatItemOptionLabel(game, e)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-small btn-craft" data-fill-combat-offer="${row.id}">Vendre</button>
          </div>` : '<span class="hdv-p2p-badge warn">Pas cet équipement en réserve</span>'}
        </div>`;
    };

    body.innerHTML = `
      ${combatRows.length ? `<h4 class="hdv-p2p-section-title">Équipement & armes</h4>${combatRows.map(renderCombatOffer).join('')}` : ''}
      ${resourceRows.length ? `<h4 class="hdv-p2p-section-title">Ressources</h4>${resourceRows.map(renderResourceOffer).join('')}` : ''}
    `;

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

    body.querySelectorAll('[data-fill-combat-offer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const offerId = btn.dataset.fillCombatOffer;
        const row = btn.closest('[data-offer-row]');
        const pick = row?.querySelector(`[data-offer-instance="${offerId}"]`);
        const instanceId = pick?.value;
        if (!instanceId) {
          notify('Sélectionne un équipement à vendre.');
          return;
        }
        btn.disabled = true;
        await game.flushSave?.();
        const r = await fillBuyOffer(offerId, 1, instanceId);
        if (!r.ok) {
          btn.disabled = false;
          notify(r.reason || 'Vente impossible.');
          return;
        }
        applyServerSave(game, r.result?.save);
        await syncMarketEconomy(game);
        const net = (r.result?.net ?? r.result?.payout - r.result?.fee) || 0;
        notify(`Équipement vendu · +${formatNumber(net)} 💰 (frais ${formatNumber(r.result?.fee || 0)} 💰)`);
        if (row) row.remove();
        emit('stateChange', game.state, { kind: 'auction' });
      });
    });
    return;
  }

  if (p2pSubTab === 'sell') {
    const combatItems = getMarketableCombatItems(game);
    body.innerHTML = `
      <nav class="hdv-p2p-sell-mode" aria-label="Type de vente">
        <button type="button" class="hdv-p2p-mode-btn${p2pSellMode === 'resource' ? ' active' : ''}" data-sell-mode="resource">Ressources</button>
        <button type="button" class="hdv-p2p-mode-btn${p2pSellMode === 'combat' ? ' active' : ''}" data-sell-mode="combat">Équipement / Armes</button>
      </nav>
      <div id="p2p-sell-form"></div>
    `;

    body.querySelectorAll('[data-sell-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        p2pSellMode = btn.dataset.sellMode;
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
    });

    const form = body.querySelector('#p2p-sell-form');

    if (p2pSellMode === 'combat') {
      if (!combatItems.length) {
        form.innerHTML = '<p class="view-desc">Aucun équipement ou arme en réserve. Déséquipe-les ou farme des donjons.</p>';
        return;
      }
      const options = combatItems.map((e) => `<option value="${e.ref}">${combatItemOptionLabel(game, e)}</option>`).join('');
      form.innerHTML = `
        <p class="view-desc">L'équipement est retiré de ton inventaire dès la publication. Prix libre entre joueurs (revente PNJ indiquée à titre indicatif).</p>
        <label class="auth-label">Pièce à vendre</label>
        <select class="auth-input" id="p2p-sell-combat">${options}</select>
        <label class="auth-label">Prix (💰)</label>
        <input type="number" class="auth-input" id="p2p-sell-combat-price" min="1" value="${combatItems[0]?.npcPrice || 50}" />
        <button type="button" class="btn btn-craft" id="p2p-sell-combat-submit">Publier vente équipement</button>
      `;
      const priceInput = form.querySelector('#p2p-sell-combat-price');
      const combatSelect = form.querySelector('#p2p-sell-combat');
      combatSelect?.addEventListener('change', () => {
        const entry = combatItems.find((e) => e.ref === combatSelect.value);
        if (entry && priceInput) priceInput.value = String(Math.max(1, entry.npcPrice || 50));
      });

      form.querySelector('#p2p-sell-combat-submit')?.addEventListener('click', async () => {
        const instanceId = combatSelect?.value;
        const unitPrice = Number(priceInput?.value) || 1;
        if (!instanceId) {
          notify('Sélectionne un équipement.');
          return;
        }
        const btn = form.querySelector('#p2p-sell-combat-submit');
        btn.disabled = true;
        await game.flushSave?.();
        const r = await createCombatSellListing({
          instanceId,
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
        notify('Annonce équipement publiée.');
        p2pSubTab = 'mine';
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
      return;
    }

    const resourceOptions = tradableResources(game)
      .map(([id, r]) => `<option value="${id}">${r.name} (×${game.state.inventory?.[id] || 0})</option>`)
      .join('');
    form.innerHTML = `
      <p class="view-desc">Les ressources sont retirées de ton inventaire dès la publication.</p>
      <label class="auth-label">Ressource</label>
      <select class="auth-input" id="p2p-sell-resource">${resourceOptions}</select>
      <label class="auth-label">Quantité</label>
      <input type="number" class="auth-input" id="p2p-sell-qty" min="1" value="1" />
      <label class="auth-label">Prix unitaire (💰)</label>
      <input type="number" class="auth-input" id="p2p-sell-price" min="1" value="10" />
      <button type="button" class="btn btn-craft" id="p2p-sell-submit">Publier vente</button>
    `;
    const qtyInput = form.querySelector('#p2p-sell-qty');
    const resSelect = form.querySelector('#p2p-sell-resource');
    const syncMax = () => {
      const have = game.state.inventory?.[resSelect?.value] || 0;
      if (qtyInput) {
        qtyInput.max = have;
        if (Number(qtyInput.value) > have) qtyInput.value = Math.max(1, have);
      }
    };
    resSelect?.addEventListener('change', syncMax);
    syncMax();

    form.querySelector('#p2p-sell-submit')?.addEventListener('click', async () => {
      const resourceId = resSelect?.value;
      const qty = Number(qtyInput?.value) || 1;
      const unitPrice = Number(form.querySelector('#p2p-sell-price')?.value) || 1;
      const have = game.state.inventory?.[resourceId] || 0;
      if (have < qty) {
        notify(`Stock insuffisant (×${have}).`);
        return;
      }
      const btn = form.querySelector('#p2p-sell-submit');
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
    body.innerHTML = `
      <nav class="hdv-p2p-sell-mode" aria-label="Type de recherche">
        <button type="button" class="hdv-p2p-mode-btn${p2pBuyOfferMode === 'resource' ? ' active' : ''}" data-buy-mode="resource">Ressources</button>
        <button type="button" class="hdv-p2p-mode-btn${p2pBuyOfferMode === 'combat' ? ' active' : ''}" data-buy-mode="combat">Équipement / Armes</button>
      </nav>
      <div id="p2p-buy-offer-form"></div>
    `;

    body.querySelectorAll('[data-buy-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        p2pBuyOfferMode = btn.dataset.buyMode;
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
    });

    const form = body.querySelector('#p2p-buy-offer-form');

    if (p2pBuyOfferMode === 'combat') {
      const catalog = getCombatCatalog(game);
      const options = catalog.map((item) => `<option value="${item.id}">${item.emoji || '⚔️'} ${item.name}</option>`).join('');
      form.innerHTML = `
        <label class="auth-label">Équipement recherché</label>
        <select class="auth-input" id="p2p-buy-combat-item">${options}</select>
        <label class="auth-label">Quantité</label>
        <input type="number" class="auth-input" id="p2p-buy-combat-qty" min="1" max="10" value="1" />
        <label class="auth-label">Prix max / pièce (💰)</label>
        <input type="number" class="auth-input" id="p2p-buy-combat-price" min="1" value="50" />
        <p class="view-desc" id="p2p-buy-combat-total">Total réservé : 50 💰</p>
        <button type="button" class="btn btn-craft" id="p2p-buy-combat-submit">Publier recherche équipement</button>
      `;
      const updateTotal = () => {
        const qty = Number(form.querySelector('#p2p-buy-combat-qty')?.value) || 1;
        const price = Number(form.querySelector('#p2p-buy-combat-price')?.value) || 1;
        const total = qty * price;
        const el = form.querySelector('#p2p-buy-combat-total');
        if (el) el.textContent = `Total réservé : ${formatNumber(total)} 💰`;
      };
      form.querySelector('#p2p-buy-combat-qty')?.addEventListener('input', updateTotal);
      form.querySelector('#p2p-buy-combat-price')?.addEventListener('input', updateTotal);
      updateTotal();

      form.querySelector('#p2p-buy-combat-submit')?.addEventListener('click', async () => {
        const itemId = form.querySelector('#p2p-buy-combat-item')?.value;
        const qty = Number(form.querySelector('#p2p-buy-combat-qty')?.value) || 1;
        const maxUnitPrice = Number(form.querySelector('#p2p-buy-combat-price')?.value) || 1;
        const total = qty * maxUnitPrice;
        if ((game.state.kirha || 0) < total) {
          notify(`Il faut ${formatNumber(total)} 💰 en escrow.`);
          return;
        }
        const btn = form.querySelector('#p2p-buy-combat-submit');
        btn.disabled = true;
        await game.flushSave?.();
        const r = await createCombatBuyOffer({
          itemId,
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
        notify('Recherche équipement publiée — Kirha réservés.');
        p2pSubTab = 'mine';
        renderMarketP2pPanel(game, container, { keepSubTab: true });
      });
      return;
    }

    const resourceOptions = tradableResources(game)
      .map(([id, r]) => `<option value="${id}">${r.name}</option>`)
      .join('');
    form.innerHTML = `
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
      const qty = Number(form.querySelector('#p2p-buy-qty')?.value) || 1;
      const price = Number(form.querySelector('#p2p-buy-price')?.value) || 1;
      const total = qty * price;
      const el = form.querySelector('#p2p-buy-total');
      if (el) el.textContent = `Total réservé : ${formatNumber(total)} 💰`;
    };
    form.querySelector('#p2p-buy-qty')?.addEventListener('input', updateTotal);
    form.querySelector('#p2p-buy-price')?.addEventListener('input', updateTotal);
    updateTotal();

    form.querySelector('#p2p-buy-submit')?.addEventListener('click', async () => {
      const resourceId = form.querySelector('#p2p-buy-resource')?.value;
      const qty = Number(form.querySelector('#p2p-buy-qty')?.value) || 1;
      const maxUnitPrice = Number(form.querySelector('#p2p-buy-price')?.value) || 1;
      const total = qty * maxUnitPrice;
      if ((game.state.kirha || 0) < total) {
        notify(`Il faut ${formatNumber(total)} 💰 en escrow.`);
        return;
      }
      const btn = form.querySelector('#p2p-buy-submit');
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
    const renderMineSell = (r) => {
      if (r.listing_kind === 'combat') {
        return `
        <div class="hdv-p2p-row hdv-p2p-row-mine hdv-p2p-row-combat">
          <div class="hdv-p2p-row-main">
            <span>${combatListingLabel(game, r)}</span>
            <span class="hdv-p2p-meta">${formatNumber(r.unit_price)} 💰</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-sell="${r.id}">Annuler</button>
        </div>`;
      }
      return `
        <div class="hdv-p2p-row hdv-p2p-row-mine">
          <div class="hdv-p2p-row-main">
            <span>${resourceLabel(game, r.resource_id)}</span>
            <span class="hdv-p2p-meta">×${r.qty_remaining} @ ${r.unit_price} 💰/u</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-sell="${r.id}">Annuler</button>
        </div>`;
    };
    const renderMineBuy = (r) => {
      if (r.listing_kind === 'combat') {
        const item = game.combatEquipment?.items?.[r.combat_item_id || r.resource_id];
        const label = item ? `${item.emoji || '⚔️'} ${item.name}` : (r.combat_item_id || r.resource_id);
        return `
        <div class="hdv-p2p-row hdv-p2p-row-mine hdv-p2p-row-combat">
          <div class="hdv-p2p-row-main">
            <span>${label}</span>
            <span class="hdv-p2p-meta">×${r.qty_remaining} max ${r.max_unit_price} 💰/pièce · ${formatNumber(r.kirha_escrowed)} 💰 bloqués</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-buy="${r.id}">Annuler</button>
        </div>`;
      }
      return `
        <div class="hdv-p2p-row hdv-p2p-row-mine">
          <div class="hdv-p2p-row-main">
            <span>${resourceLabel(game, r.resource_id)}</span>
            <span class="hdv-p2p-meta">×${r.qty_remaining} max ${r.max_unit_price} 💰/u · ${formatNumber(r.kirha_escrowed)} 💰 bloqués</span>
          </div>
          <button type="button" class="btn btn-small btn-danger" data-cancel-buy="${r.id}">Annuler</button>
        </div>`;
    };

    body.innerHTML = `
      <h4 class="hdv-p2p-section-title">Mes ventes</h4>
      ${mine.sells.length ? mine.sells.map(renderMineSell).join('') : '<p class="view-desc">Aucune vente active.</p>'}
      <h4 class="hdv-p2p-section-title">Mes recherches</h4>
      ${mine.buys.length ? mine.buys.map(renderMineBuy).join('') : '<p class="view-desc">Aucune recherche active.</p>'}
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

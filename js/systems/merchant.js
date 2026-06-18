export function getVendorOffer(merchant, vendorId, offerId) {
  const vendor = merchant?.vendors?.[vendorId];
  return vendor?.offers?.[offerId] || null;
}

export function getBuyPrice(offer, quantity) {
  if (!offer || quantity <= 0) return null;
  return offer.unitPrice * quantity;
}

export function canBuyOffer(offer, quantity, state, resources) {
  if (!offer || quantity <= 0) return false;
  const resource = resources[offer.resourceId];
  if (!resource?.merchantOnly) return false;
  const price = getBuyPrice(offer, quantity);
  return price !== null && state.kirha >= price;
}

export function buyOffer(offer, quantity, state, resources) {
  if (!canBuyOffer(offer, quantity, state, resources)) return false;

  const price = getBuyPrice(offer, quantity);
  state.kirha -= price;
  state.inventory[offer.resourceId] = (state.inventory[offer.resourceId] || 0) + quantity;
  return { resourceId: offer.resourceId, quantity, price };
}

export function getSellPrice(offer, quantity) {
  if (!offer?.sellable || quantity <= 0) return null;
  const unitSell = Math.floor(offer.unitPrice / 2);
  if (unitSell <= 0) return null;
  return unitSell * quantity;
}

export function canSellOffer(offer, quantity, state) {
  if (!offer?.sellable || quantity <= 0) return false;
  return (state.inventory[offer.resourceId] || 0) >= quantity;
}

export function sellOffer(offer, quantity, state) {
  if (!canSellOffer(offer, quantity, state)) return false;

  const price = getSellPrice(offer, quantity);
  state.inventory[offer.resourceId] -= quantity;
  if (state.inventory[offer.resourceId] <= 0) delete state.inventory[offer.resourceId];
  state.kirha += price;
  return { resourceId: offer.resourceId, quantity, price };
}

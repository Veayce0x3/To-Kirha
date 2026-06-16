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

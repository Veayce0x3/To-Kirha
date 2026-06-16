import { getArtisanSellBonus } from './craft.js';

export function getUpgradeCost(upgrade, level, multiplier) {
  return Math.floor(upgrade.baseCost * Math.pow(multiplier, level));
}

export function sellResource(resourceId, amount, resources, inventory, priceMultiplier = 1) {
  if (!inventory[resourceId] || inventory[resourceId] < amount) return 0;
  const resource = resources[resourceId];
  if (resource.notSellable || resource.merchantOnly) return 0;
  const earnings = Math.floor(resource.sellPrice * amount * priceMultiplier);
  inventory[resourceId] -= amount;
  return earnings;
}

export function sellAll(inventory, resources, jobs, state) {
  let total = 0;
  const artisanBonus = state && jobs ? getArtisanSellBonus(state, jobs) : 1;

  for (const [id, amount] of Object.entries(inventory)) {
    if (amount > 0 && resources[id] && !resources[id].notSellable && !resources[id].merchantOnly) {
      const multiplier = resources[id].craftOnly ? artisanBonus : 1;
      total += sellResource(id, amount, resources, inventory, multiplier);
    }
  }
  return total;
}

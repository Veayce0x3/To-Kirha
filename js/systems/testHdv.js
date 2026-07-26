/**
 * Ancien HDV test (beta) — désactivé / retiré.
 * Conservé comme stubs pour éviter les imports cassés.
 */

export function isTestHdvEnabled() {
  return false;
}

export function buildTestHdvVendors() {
  return {};
}

export function mergeMerchantVendors(baseMerchant, _extraVendors = {}) {
  return baseMerchant || { vendors: {} };
}

export function getTestHdvBanner() {
  return null;
}

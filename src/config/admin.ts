/**
 * Wallets autorisés à ouvrir la console admin.
 * Les actions on-chain passent par le worker (ADMIN_PRIVATE_KEY + X-Admin-Token).
 */
const RAW = ['0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C'] as const;

export const ADMIN_WALLET_SET = new Set(RAW.map(a => a.toLowerCase()));

export function isAdminWallet(address: string | undefined): boolean {
  return !!address && ADMIN_WALLET_SET.has(address.toLowerCase());
}

export const ADMIN_RELAYER_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_RELAYER_URL) ||
  'https://kirha-relayer.tokirha.workers.dev';

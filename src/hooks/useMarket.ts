import { useState, useCallback, useMemo } from 'react';
import { useReadContract, useWriteContract, usePublicClient, useSwitchChain, useAccount, useSignMessage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

const WC_RELAYER_SESSION_KEY = 'kirha_wc_relayer_step';

function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
import { parseEther, formatEther } from 'viem';
import { KIRHA_MARKET_ADDRESS, KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';

const RELAYER_URL = 'https://kirha-relayer.tokirha.workers.dev';

export interface OnChainListing {
  listingId:       bigint;
  sellerCityId:    bigint;
  sellerPseudo:    string;
  resourceId:      number;
  quantity:        number;       // quantité réelle (non scalée)
  pricePerUnit:    number;       // en $KIRHA (float)
  pricePerUnitWei: bigint;
}

export type MarketStatus = 'idle' | 'listing' | 'buying' | 'cancelling' | 'success' | 'error';

function getSecondsUntilMidnightParis(): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour')!.value);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value);
  const s = parseInt(parts.find(p => p.type === 'second')!.value);
  let secs = 86400 - (h * 3600 + m * 60 + s);
  if (secs < 3600) secs += 86400;
  return secs;
}

export function useMarket() {
  const [status, setStatus] = useState<MarketStatus>('idle');
  const [error, setError]   = useState<string | null>(null);
  const [relayerWcHint, setRelayerWcHint] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync }   = useSwitchChain();
  const { address, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  // Switch vers Base Sepolia si le wallet est sur une autre chaîne
  async function ensureChain() {
    try { await switchChainAsync({ chainId: baseSepolia.id }); } catch {}
  }

  const villeId          = useGameStore(s => s.villeId);
  const retirerRessource = useGameStore(s => s.retirerRessource);
  const ajouterRessource = useGameStore(s => s.ajouterRessource);
  const retirerKirha     = useGameStore(s => s.retirerKirha);

  const cityIdBn = villeId && villeId !== '0' ? BigInt(villeId) : undefined;

  // ── État relayer pour cette ville ─────────────────────────
  const { data: relayerActive, refetch: refetchRelayer } = useReadContract({
    address:      KIRHA_GAME_ADDRESS,
    abi:          KirhaGameAbi,
    functionName: 'isRelayerActive',
    args:         cityIdBn ? [cityIdBn] : undefined,
    query: { enabled: !!cityIdBn, refetchInterval: 5_000 },
  });

  // ── Lire les listings actifs ───────────────────────────────
  const { data: listingsRaw, refetch: refetchListings } = useReadContract({
    address:      KIRHA_MARKET_ADDRESS,
    abi:          KirhaMarketAbi,
    functionName: 'getActiveListings',
    args:         [0n, 100n],
    query:        { refetchInterval: 5000 },
  });

  // IDs uniques des villes vendeuses (pour batch-fetch des pseudos)
  const uniqueSellerCityIds = useMemo(() => {
    if (!listingsRaw) return [];
    const [items] = listingsRaw as [readonly { sellerCityId: bigint }[], readonly bigint[]];
    return [...new Set(items.map(i => i.sellerCityId))];
  }, [listingsRaw]);

  // ── Fetch batch des pseudos vendeurs ──────────────────────
  const { data: pseudosRaw } = useReadContract({
    address:      KIRHA_GAME_ADDRESS,
    abi:          KirhaGameAbi,
    functionName: 'getCityPseudos',
    args:         [uniqueSellerCityIds],
    query:        { enabled: uniqueSellerCityIds.length > 0 },
  });

  const pseudoMap = useMemo((): Map<bigint, string> => {
    const map = new Map<bigint, string>();
    if (!pseudosRaw) return map;
    const pseudos = pseudosRaw as string[];
    uniqueSellerCityIds.forEach((id, i) => map.set(id, pseudos[i] ?? '?'));
    return map;
  }, [pseudosRaw, uniqueSellerCityIds]);

  // ── Parser les listings bruts ──────────────────────────────
  const listings: OnChainListing[] = (() => {
    if (!listingsRaw) return [];
    const [items, ids] = listingsRaw as [
      readonly { sellerCityId: bigint; resourceId: bigint; quantity: bigint; pricePerUnit: bigint; active: boolean }[],
      readonly bigint[]
    ];
    return items.map((item, i) => ({
      listingId:       ids[i],
      sellerCityId:    item.sellerCityId,
      sellerPseudo:    pseudoMap.get(item.sellerCityId) ?? '…',
      resourceId:      Number(item.resourceId),
      quantity:        Number(item.quantity) / 1e4,
      pricePerUnit:    parseFloat(formatEther(item.pricePerUnit)),
      pricePerUnitWei: item.pricePerUnit,
    }));
  })();

  const signRelayerPayload = useCallback(async (
    action: string,
    cityId: string,
    extraFields: Record<string, string>,
  ) => {
    if (!address) throw new Error('Wallet non connecté.');
    const nonce = Date.now().toString();
    const deadline = (Math.floor(Date.now() / 1000) + 300).toString();
    const fields: Record<string, string> = {
      wallet: address.toLowerCase(),
      cityId,
      nonce,
      deadline,
      ...extraFields,
    };
    const lines = Object.keys(fields).sort().map(k => `${k}:${fields[k]}`);
    const message = ['To-Kirha Relayer', `action:${action}`, ...lines].join('\n');
    const signature = await signMessageAsync({ message });
    return { wallet: address, nonce, deadline, signature };
  }, [address, signMessageAsync]);

  // ── Helper : POST vers le relayer ──────────────────────────
  async function relayerPost(endpoint: string, body: unknown): Promise<void> {
    const res = await fetch(`${RELAYER_URL}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'Erreur relayer');
      let msg = text;
      try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch {}
      throw new Error(msg);
    }
  }

  // ── Mettre en vente (1 ressource) ─────────────────────────
  const mettrEnVente = useCallback(async (
    resourceId: number, quantity: number, pricePerUnit: number
  ) => {
    if (!cityIdBn || !villeId) return;
    setError(null);
    setStatus('listing');
    try {
      if (relayerActive) {
        const signed = await signRelayerPayload('market_list', villeId, {
          resourceId: String(resourceId),
          quantity: String(Math.floor(quantity)),
          pricePerUnit: parseEther(pricePerUnit.toString()).toString(),
        });
        await relayerPost('/market/list', {
          cityId:       villeId,
          resourceId:   String(resourceId),
          quantity:     String(Math.floor(quantity)),
          pricePerUnit: parseEther(pricePerUnit.toString()).toString(),
          ...signed,
        });
      } else {
        await ensureChain();
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'listResource',
          args:         [cityIdBn, BigInt(resourceId), BigInt(Math.floor(quantity)), parseEther(pricePerUnit.toString())],
          chainId:      baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      retirerRessource(resourceId as ResourceId, Math.floor(quantity));
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, villeId, relayerActive, writeContractAsync, publicClient, retirerRessource, refetchListings]);

  // ── Mettre en vente (batch — 1 appel) ─────────────────────
  const batchMettrEnVente = useCallback(async (
    items: { resourceId: number; quantity: number; pricePerUnit: number }[]
  ) => {
    if (!cityIdBn || !villeId || items.length === 0) return;
    setError(null);
    setStatus('listing');
    try {
      if (relayerActive) {
        // Appels séquentiels (le relayer gère les nonces)
        for (const item of items) {
          const signed = await signRelayerPayload('market_list', villeId, {
            resourceId: String(item.resourceId),
            quantity: String(Math.floor(item.quantity)),
            pricePerUnit: parseEther(item.pricePerUnit.toString()).toString(),
          });
          await relayerPost('/market/list', {
            cityId:       villeId,
            resourceId:   String(item.resourceId),
            quantity:     String(Math.floor(item.quantity)),
            pricePerUnit: parseEther(item.pricePerUnit.toString()).toString(),
            ...signed,
          });
        }
      } else {
        await ensureChain();
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'batchListResources',
          args: [
            cityIdBn,
            items.map(i => BigInt(i.resourceId)),
            items.map(i => BigInt(Math.floor(i.quantity))),
            items.map(i => parseEther(i.pricePerUnit.toString())),
          ],
          chainId: baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      for (const item of items) {
        retirerRessource(item.resourceId as ResourceId, Math.floor(item.quantity));
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, villeId, relayerActive, writeContractAsync, refetchListings, publicClient, retirerRessource]);

  // ── Acheter (unitaire) ────────────────────────────────────
  const acheter = useCallback(async (listingId: bigint, quantity: number, resourceId: number, pricePerUnit = 0) => {
    if (!cityIdBn || !villeId) return;
    setError(null);
    setStatus('buying');
    try {
      if (relayerActive) {
        const signed = await signRelayerPayload('market_buy', villeId, {
          listingId: listingId.toString(),
          quantity: String(Math.floor(quantity)),
        });
        await relayerPost('/market/buy', {
          listingId:   listingId.toString(),
          buyerCityId: villeId,
          quantity:    String(Math.floor(quantity)),
          ...signed,
        });
      } else {
        await ensureChain();
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'buyResource',
          args:         [listingId, cityIdBn, BigInt(Math.floor(quantity))],
          chainId:      baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      ajouterRessource(resourceId as ResourceId, quantity);
      if (pricePerUnit > 0) retirerKirha(quantity * pricePerUnit);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, villeId, relayerActive, writeContractAsync, refetchListings, publicClient, ajouterRessource, retirerKirha]);

  // ── Acheter (panier — batch) ───────────────────────────────
  const batchAcheter = useCallback(async (
    items: { listingId: bigint; quantity: number; resourceId: number; pricePerUnit?: number }[]
  ) => {
    if (!cityIdBn || !villeId || items.length === 0) return;
    setError(null);
    setStatus('buying');
    try {
      if (relayerActive) {
        for (const item of items) {
          const signed = await signRelayerPayload('market_buy', villeId, {
            listingId: item.listingId.toString(),
            quantity: String(Math.floor(item.quantity)),
          });
          await relayerPost('/market/buy', {
            listingId:   item.listingId.toString(),
            buyerCityId: villeId,
            quantity:    String(Math.floor(item.quantity)),
            ...signed,
          });
        }
      } else {
        await ensureChain();
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'batchBuyResources',
          args: [
            cityIdBn,
            items.map(i => i.listingId),
            items.map(i => BigInt(Math.floor(i.quantity))),
          ],
          chainId: baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      for (const item of items) {
        ajouterRessource(item.resourceId as ResourceId, item.quantity);
        if (item.pricePerUnit && item.pricePerUnit > 0) retirerKirha(item.quantity * item.pricePerUnit);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, villeId, relayerActive, writeContractAsync, refetchListings, publicClient, ajouterRessource, retirerKirha]);

  // ── Activer le relayer (jusqu'à minuit Paris) ─────────────────
  const activerRelayer = useCallback(async (): Promise<boolean> => {
    if (!cityIdBn) return false;
    setStatus('listing');
    setError(null);
    setRelayerWcHint(null);
    const durationSecs = getSecondsUntilMidnightParis();
    const expiresAt = Math.floor(Date.now() / 1000) + durationSecs;
    if (villeId) localStorage.setItem(`kirha_relayer_expires_${villeId}`, String(expiresAt));
    const isWalletConnect = connector?.id === 'walletConnect';
    const mobile = isMobileUa();

    try {
      // WalletConnect + mobile : séparer changement de réseau et tx (sinon MetaMask ne montre pas la 2e demande)
      if (isWalletConnect && mobile && sessionStorage.getItem(WC_RELAYER_SESSION_KEY) !== 'tx') {
        try {
          await switchChainAsync({ chainId: baseSepolia.id });
          sessionStorage.setItem(WC_RELAYER_SESSION_KEY, 'tx');
          setRelayerWcHint('Réseau validé. Touche encore « Activer » pour signer la transaction.');
          setStatus('idle');
          return false;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          const isRejected = msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel');
          if (isRejected && villeId) localStorage.removeItem(`kirha_relayer_expires_${villeId}`);
          setError(isRejected ? 'Changement de réseau annulé.' : msg.slice(0, 80));
          setStatus('error');
          return false;
        }
      }

      if (!isWalletConnect) await ensureChain();

      const txPromise = writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'authorizeRelayer',
        args:         [cityIdBn, BigInt(durationSecs)],
        chainId:      baseSepolia.id,
      });
      const hash = await Promise.race([
        txPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Délai dépassé (45s). Déconnecte/reconnecte ton wallet puis réessaie.')), 45_000)
        ),
      ]);
      sessionStorage.removeItem(WC_RELAYER_SESSION_KEY);
      setRelayerWcHint(null);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
      if (publicClient) {
        publicClient.waitForTransactionReceipt({ hash }).then(() => {
          refetchRelayer();
        }).catch(() => {});
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      const isRejected = msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel');
      if (isRejected && villeId) localStorage.removeItem(`kirha_relayer_expires_${villeId}`);
      if ((relayerActive as boolean)) {
        setStatus('idle');
        return true;
      }
      setError(isRejected ? 'Transaction annulée.' : msg.slice(0, 80));
      setStatus('error');
      return false;
    }
  }, [cityIdBn, writeContractAsync, publicClient, villeId, relayerActive, refetchRelayer, connector, switchChainAsync]);

  // ── Annuler un listing ─────────────────────────────────────
  const annulerListing = useCallback(async (listingId: bigint) => {
    setError(null);
    setStatus('cancelling');
    // Retrouver les infos du listing pour restaurer la ressource
    const listing = listings.find(l => l.listingId === listingId);
    try {
      if (relayerActive) {
        const signed = await signRelayerPayload('market_cancel', villeId ?? '0', {
          listingId: listingId.toString(),
        });
        await relayerPost('/market/cancel', { listingId: listingId.toString(), cityId: villeId, ...signed });
      } else {
        await ensureChain();
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'cancelListing',
          args:         [listingId],
          chainId:      baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      // Restaurer la ressource dans l'inventaire local
      if (listing) ajouterRessource(listing.resourceId as ResourceId, listing.quantity);
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [listings, relayerActive, writeContractAsync, refetchListings, publicClient, ajouterRessource, signRelayerPayload, villeId]);

  const myListings = listings.filter(l => cityIdBn && l.sellerCityId === cityIdBn);

  return {
    listings,
    myListings,
    isApproved: true,
    isRelayerActive: !!relayerActive,
    status,
    error,
    relayerWcHint,
    approveMarket: async () => {},
    mettrEnVente,
    batchMettrEnVente,
    acheter,
    batchAcheter,
    annulerListing,
    activerRelayer,
    refetchListings,
    refetchRelayer,
  };
}

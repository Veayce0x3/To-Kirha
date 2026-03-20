import { useState, useCallback, useMemo } from 'react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
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

export function useMarket() {
  const [status, setStatus] = useState<MarketStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const villeId          = useGameStore(s => s.villeId);
  const retirerRessource = useGameStore(s => s.retirerRessource);
  const ajouterRessource = useGameStore(s => s.ajouterRessource);
  const retirerKirha     = useGameStore(s => s.retirerKirha);

  const cityIdBn = villeId && villeId !== '0' ? BigInt(villeId) : undefined;

  // ── État relayer pour cette ville ─────────────────────────
  const { data: relayerActive } = useReadContract({
    address:      KIRHA_GAME_ADDRESS,
    abi:          KirhaGameAbi,
    functionName: 'isRelayerActive',
    args:         cityIdBn ? [cityIdBn] : undefined,
    query: { enabled: !!cityIdBn, refetchInterval: 60_000 },
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
        await relayerPost('/market/list', {
          cityId:       villeId,
          resourceId:   String(resourceId),
          quantity:     String(Math.floor(quantity)),
          pricePerUnit: parseEther(pricePerUnit.toString()).toString(),
        });
      } else {
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
          await relayerPost('/market/list', {
            cityId:       villeId,
            resourceId:   String(item.resourceId),
            quantity:     String(Math.floor(item.quantity)),
            pricePerUnit: parseEther(item.pricePerUnit.toString()).toString(),
          });
        }
      } else {
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
        await relayerPost('/market/buy', {
          listingId:   listingId.toString(),
          buyerCityId: villeId,
          quantity:    String(Math.floor(quantity)),
        });
      } else {
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
          await relayerPost('/market/buy', {
            listingId:   item.listingId.toString(),
            buyerCityId: villeId,
            quantity:    String(Math.floor(item.quantity)),
          });
        }
      } else {
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

  // ── Activer le relayer (8h) ────────────────────────────────
  const activerRelayer = useCallback(async () => {
    if (!cityIdBn) return;
    setStatus('listing');
    setError(null);
    try {
      const hash = await writeContractAsync({
        address:  KIRHA_GAME_ADDRESS,
        abi:      KirhaGameAbi,
        functionName: 'authorizeRelayer',
        args:     [cityIdBn, 43200n],
        chainId:  baseSepolia.id,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      if (villeId) localStorage.setItem(`kirha_relayer_at_${villeId}`, Date.now().toString());
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, writeContractAsync, publicClient]);

  // ── Annuler un listing ─────────────────────────────────────
  const annulerListing = useCallback(async (listingId: bigint) => {
    setError(null);
    setStatus('cancelling');
    try {
      if (relayerActive) {
        await relayerPost('/market/cancel', { listingId: listingId.toString() });
      } else {
        const hash = await writeContractAsync({
          address:      KIRHA_MARKET_ADDRESS,
          abi:          KirhaMarketAbi,
          functionName: 'cancelListing',
          args:         [listingId],
          chainId:      baseSepolia.id,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [relayerActive, writeContractAsync, refetchListings, publicClient]);

  const myListings = listings.filter(l => cityIdBn && l.sellerCityId === cityIdBn);

  return {
    listings,
    myListings,
    isApproved: true,
    isRelayerActive: !!relayerActive,
    status,
    error,
    approveMarket: async () => {},
    mettrEnVente,
    batchMettrEnVente,
    acheter,
    batchAcheter,
    annulerListing,
    activerRelayer,
    refetchListings,
  };
}

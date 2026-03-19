import { useState, useCallback, useMemo } from 'react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { KIRHA_MARKET_ADDRESS, KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';

export interface OnChainListing {
  listingId:       bigint;
  sellerCityId:    bigint;
  sellerPseudo:    string;       // pseudo lié à la ville vendeur
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

  const cityIdBn = villeId && villeId !== '0' ? BigInt(villeId) : undefined;

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
  // quantity on-chain est scalée ×1e4 (ex: 10 unités = 100000)
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
      quantity:        Number(item.quantity) / 1e4,   // dé-scaler
      pricePerUnit:    parseFloat(formatEther(item.pricePerUnit)),
      pricePerUnitWei: item.pricePerUnit,
    }));
  })();

  // ── Mettre en vente (batch — 1 signature) ─────────────────
  const batchMettrEnVente = useCallback(async (
    items: { resourceId: number; quantity: number; pricePerUnit: number }[]
  ) => {
    if (!cityIdBn || items.length === 0) return;
    setError(null);
    setStatus('listing');
    try {
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
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      // Retirer de l'inventaire local
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
  }, [cityIdBn, writeContractAsync, refetchListings, publicClient, retirerRessource]);

  // ── Acheter (panier — batch) ───────────────────────────────
  const batchAcheter = useCallback(async (
    items: { listingId: bigint; quantity: number; resourceId: number }[]
  ) => {
    if (!cityIdBn || items.length === 0) return;
    setError(null);
    setStatus('buying');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'batchBuyResources',
        args: [
          cityIdBn,
          items.map(i => i.listingId),
          items.map(i => BigInt(Math.floor(i.quantity))),
        ],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      for (const item of items) {
        ajouterRessource(item.resourceId as ResourceId, item.quantity);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, writeContractAsync, refetchListings, publicClient, ajouterRessource]);

  // ── Acheter (unitaire) ────────────────────────────────────
  const acheter = useCallback(async (listingId: bigint, quantity: number, resourceId: number) => {
    if (!cityIdBn) return;
    setError(null);
    setStatus('buying');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'buyResource',
        args:         [listingId, cityIdBn, BigInt(Math.floor(quantity))],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      ajouterRessource(resourceId as ResourceId, quantity);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [cityIdBn, writeContractAsync, refetchListings, publicClient, ajouterRessource]);

  // ── Annuler un listing ─────────────────────────────────────
  const annulerListing = useCallback(async (listingId: bigint) => {
    setError(null);
    setStatus('cancelling');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'cancelListing',
        args:         [listingId],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [writeContractAsync, refetchListings, publicClient]);

  const myListings = listings.filter(l => cityIdBn && l.sellerCityId === cityIdBn);

  return {
    listings,
    myListings,
    isApproved: true,   // Plus besoin d'approbation ERC-1155
    status,
    error,
    approveMarket: async () => {},  // No-op (kept for interface compatibility)
    mettrEnVente: async (_rid: number, qty: number, price: number) =>
      batchMettrEnVente([{ resourceId: _rid, quantity: qty, pricePerUnit: price }]),
    batchMettrEnVente,
    acheter,
    batchAcheter,
    annulerListing,
    refetchListings,
  };
}

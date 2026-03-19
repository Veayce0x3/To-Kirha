import { useState, useCallback } from 'react';
import { useReadContract, useWriteContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { KIRHA_MARKET_ADDRESS, KIRHA_RESOURCES_ADDRESS } from '../contracts/addresses';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';

// ERC-1155 approval ABI (minimal)
const ERC1155_ABI = [
  {
    name: 'isApprovedForAll',
    type: 'function' as const,
    inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const,
  },
  {
    name: 'setApprovalForAll',
    type: 'function' as const,
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
] as const;

export interface OnChainListing {
  listingId: bigint;
  seller: string;
  resourceId: number;
  quantity: number;
  pricePerUnit: number; // in $KIRHA (float)
  pricePerUnitWei: bigint;
}

export type MarketStatus = 'idle' | 'approving' | 'listing' | 'buying' | 'cancelling' | 'success' | 'error';

export function useMarket() {
  const { address } = useAccount();
  const [status, setStatus] = useState<MarketStatus>('idle');
  const [error, setError]   = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const retirerRessource = useGameStore(s => s.retirerRessource);

  // ── Lire les listings actifs ───────────────────────────────
  const { data: listingsRaw, refetch: refetchListings } = useReadContract({
    address:      KIRHA_MARKET_ADDRESS,
    abi:          KirhaMarketAbi,
    functionName: 'getActiveListings',
    args:         [0n, 100n],
    query:        { refetchInterval: 5000 },
  });

  // ── Vérifier approbation ERC-1155 ─────────────────────────
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address:      KIRHA_RESOURCES_ADDRESS,
    abi:          ERC1155_ABI,
    functionName: 'isApprovedForAll',
    args:         address ? [address, KIRHA_MARKET_ADDRESS] : undefined,
    query:        { enabled: !!address },
  });

  // ── Parser les listings bruts ──────────────────────────────
  const listings: OnChainListing[] = (() => {
    if (!listingsRaw) return [];
    const [items, ids] = listingsRaw as [readonly { seller: string; resourceId: bigint; quantity: bigint; pricePerUnit: bigint; active: boolean }[], readonly bigint[]];
    return items.map((item, i) => ({
      listingId:       ids[i],
      seller:          item.seller,
      resourceId:      Number(item.resourceId),
      quantity:        Number(item.quantity),
      pricePerUnit:    parseFloat(formatEther(item.pricePerUnit)),
      pricePerUnitWei: item.pricePerUnit,
    }));
  })();

  // ── Approuver KirhaMarket sur ERC-1155 ────────────────────
  const approveMarket = useCallback(async () => {
    setError(null);
    setStatus('approving');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_RESOURCES_ADDRESS,
        abi:          ERC1155_ABI,
        functionName: 'setApprovalForAll',
        args:         [KIRHA_MARKET_ADDRESS, true],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchApproval();
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [writeContractAsync, refetchApproval, publicClient]);

  // ── Mettre en vente (batch) ───────────────────────────────
  const batchMettrEnVente = useCallback(async (items: { resourceId: number; quantity: number; pricePerUnit: number }[]) => {
    if (!address || items.length === 0) return;
    setError(null);
    setStatus('listing');
    try {
      if (!isApproved) {
        await approveMarket();
      }
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'batchListResources',
        args: [
          items.map(i => BigInt(i.resourceId)),
          items.map(i => BigInt(i.quantity)),
          items.map(i => parseEther(i.pricePerUnit.toString())),
        ],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      // Décrémenter l'inventaire local pour chaque ressource listée
      for (const item of items) {
        retirerRessource(item.resourceId as ResourceId, item.quantity);
      }
      // Attendre que le nœud RPC propage l'état avant de refetch
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [address, isApproved, approveMarket, writeContractAsync, refetchListings, publicClient, retirerRessource]);

  // ── Mettre en vente (unitaire, gardé pour compatibilité) ──
  const mettrEnVente = useCallback(async (resourceId: number, quantity: number, pricePerUnit: number) => {
    if (!address) return;
    setError(null);
    setStatus('listing');
    try {
      if (!isApproved) {
        await approveMarket();
      }
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'listResource',
        args:         [BigInt(resourceId), BigInt(quantity), parseEther(pricePerUnit.toString())],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchListings();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStatus('error');
    }
  }, [address, isApproved, approveMarket, writeContractAsync, refetchListings, publicClient]);

  // ── Acheter ───────────────────────────────────────────────
  const acheter = useCallback(async (listingId: bigint, quantity: number) => {
    setError(null);
    setStatus('buying');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_MARKET_ADDRESS,
        abi:          KirhaMarketAbi,
        functionName: 'buyResource',
        args:         [listingId, BigInt(quantity)],
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

  const myListings = listings.filter(l => l.seller.toLowerCase() === address?.toLowerCase());

  return {
    listings,
    myListings,
    isApproved: !!isApproved,
    status,
    error,
    approveMarket,
    mettrEnVente,
    batchMettrEnVente,
    acheter,
    annulerListing,
    refetchListings,
  };
}

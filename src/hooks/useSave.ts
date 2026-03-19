import { useCallback, useState } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { useGameStore } from '../store/gameStore';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

export type SaveStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

export function useSave() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const pendingMints           = useGameStore(s => s.pending_mints);
  const soustraireMintesPending = useGameStore(s => s.soustraireMintesPending);
  const setSauvegarde          = useGameStore(s => s.setSauvegarde);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Seules les entrées dont la partie entière est ≥ 1 peuvent être mintées
  const mintableItems = pendingMints
    .map(p => ({ resource_id: p.resource_id, quantite: Math.floor(p.quantite) }))
    .filter(p => p.quantite >= 1);

  const sauvegarder = useCallback(async () => {
    if (mintableItems.length === 0 || status === 'signing' || status === 'pending') return;
    setError(null);
    setStatus('signing');

    try {
      const ids     = mintableItems.map(p => BigInt(p.resource_id));
      const amounts = mintableItems.map(p => BigInt(p.quantite));
      setStatus('pending');

      const hash = await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'batchMintResources',
        args:         [ids, amounts],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      // Soustraire uniquement les quantités entières mintées (conserver les fractions)
      soustraireMintesPending(mintableItems);
      setSauvegarde(Date.now());
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [mintableItems, status, writeContractAsync, publicClient, soustraireMintesPending, setSauvegarde]);

  return {
    sauvegarder,
    status,
    error,
    // Badge = nb de ressources différentes mintables (quantité entière ≥ 1)
    pendingCount: mintableItems.length,
    reset: () => { setStatus('idle'); setError(null); },
  };
}

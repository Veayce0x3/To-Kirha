import { useCallback, useState } from 'react';
import { useWriteContract } from 'wagmi';
import { useGameStore } from '../store/gameStore';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

export type SaveStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

export function useSave() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const pendingMints      = useGameStore(s => s.pending_mints);
  const viderPendingMints = useGameStore(s => s.viderPendingMints);
  const setSauvegarde     = useGameStore(s => s.setSauvegarde);

  const { writeContractAsync } = useWriteContract();

  const sauvegarder = useCallback(async () => {
    if (pendingMints.length === 0 || status === 'signing' || status === 'pending') return;
    setError(null);
    setStatus('signing');

    try {
      const ids     = pendingMints.map(p => BigInt(p.resource_id));
      const amounts = pendingMints.map(p => BigInt(p.quantite));
      setStatus('pending');

      // Note : nonce + signature seront ajoutés quand le backend sera en place
      // Pour le dev, le contrat peut être déployé sans vérification de signature
      await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'batchMintResources',
        args:         [ids, amounts, BigInt(0), '0x'],
      });

      viderPendingMints();
      setSauvegarde(Date.now());
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [pendingMints, status, writeContractAsync, viderPendingMints, setSauvegarde]);

  return {
    sauvegarder,
    status,
    error,
    pendingCount: pendingMints.length,
    reset: () => { setStatus('idle'); setError(null); },
  };
}

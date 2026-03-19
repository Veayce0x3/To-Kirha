import { useCallback, useState } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { useGameStore } from '../store/gameStore';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import { MetierId } from '../data/metiers';

export type SaveStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

// Mapping métier string → id uint8 on-chain
const METIER_TO_ID: Record<MetierId, number> = {
  bucheron: 0, paysan: 1, pecheur: 2, mineur: 3, alchimiste: 4,
};
const METIER_IDS: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];

export function useSave() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const pendingMints           = useGameStore(s => s.pending_mints);
  const metiers                = useGameStore(s => s.metiers);
  const villeId                = useGameStore(s => s.villeId);
  const kirhaEarned            = useGameStore(s => s.kirhaEarned);
  const soustraireMintesPending = useGameStore(s => s.soustraireMintesPending);
  const setSauvegarde          = useGameStore(s => s.setSauvegarde);
  const resetKirhaEarned       = useGameStore(s => s.resetKirhaEarned);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Ressources mintables : quantité entière ≥ 1 uniquement
  const mintableItems = pendingMints
    .map(p => ({ resource_id: p.resource_id, quantite: Math.floor(p.quantite) }))
    .filter(p => p.quantite >= 1);

  const hasSomethingToSave = mintableItems.length > 0 || kirhaEarned > 0;

  const sauvegarder = useCallback(async () => {
    if (!hasSomethingToSave || status === 'signing' || status === 'pending') return;
    if (!villeId || villeId === '0') return;

    setError(null);
    setStatus('signing');

    try {
      // ── Ressources ──────────────────────────────────────────
      const resourceIds  = mintableItems.map(p => BigInt(p.resource_id));
      // Scaled ×1e4 pour les décimales on-chain
      const resourceAmts = mintableItems.map(p => BigInt(Math.round(p.quantite * 1e4)));

      // ── Métiers ─────────────────────────────────────────────
      const metierIds     = METIER_IDS.map(id => METIER_TO_ID[id]);
      const metierLevels  = METIER_IDS.map(id => metiers[id].niveau);
      const metierXps     = METIER_IDS.map(id => metiers[id].xp);
      const metierXpTotals = METIER_IDS.map(id => metiers[id].xp_total);

      // ── $KIRHA gagné depuis la dernière save ─────────────────
      const kirhaWei = parseEther(kirhaEarned.toFixed(6));

      setStatus('pending');

      const hash = await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'batchSave',
        args: [
          BigInt(villeId),
          resourceIds,
          resourceAmts,
          metierIds,
          metierLevels,
          metierXps,
          metierXpTotals,
          kirhaWei,
        ],
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      soustraireMintesPending(mintableItems);
      resetKirhaEarned();
      setSauvegarde(Date.now());
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [
    hasSomethingToSave, mintableItems, metiers, villeId, kirhaEarned,
    status, writeContractAsync, publicClient,
    soustraireMintesPending, setSauvegarde, resetKirhaEarned,
  ]);

  return {
    sauvegarder,
    status,
    error,
    pendingCount: mintableItems.length + (kirhaEarned > 0 ? 1 : 0),
    reset: () => { setStatus('idle'); setError(null); },
  };
}

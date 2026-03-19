import { useCallback, useState } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { useGameStore } from '../store/gameStore';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

export type WithdrawStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

export function useWithdraw() {
  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const soldeKirha         = useGameStore(s => s.soldeKirha);
  const villeId            = useGameStore(s => s.villeId);
  const retirerKirha       = useGameStore(s => s.retirerKirha);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const retirer = useCallback(async (montant: number) => {
    if (montant <= 0 || status === 'signing' || status === 'pending') return;
    if (montant > soldeKirha) return;
    if (!villeId || villeId === '0') return;

    setError(null);
    setStatus('signing');

    try {
      const amountWei = parseEther(montant.toString());
      setStatus('pending');
      const hash = await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'withdrawKirha',
        args:         [BigInt(villeId), amountWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      retirerKirha(montant);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [soldeKirha, villeId, status, writeContractAsync, publicClient, retirerKirha]);

  return { retirer, status, error, soldeKirha };
}

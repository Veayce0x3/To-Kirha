import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatUnits } from 'viem';
import { useGameStore } from '../store/gameStore';
import { KIRHA_TOKEN_ADDRESS, KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

export type DepositStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export function useDeposit() {
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();
  const villeId     = useGameStore(s => s.villeId);
  const ajouterKirha = useGameStore(s => s.ajouterKirha);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: balanceWei, refetch } = useReadContract({
    address:      KIRHA_TOKEN_ADDRESS,
    abi:          ERC20_ABI,
    functionName: 'balanceOf',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address },
  });

  const balanceKirha = balanceWei ? parseFloat(formatUnits(balanceWei as bigint, 18)) : 0;

  /**
   * Dépose des $KIRHA ERC-20 dans la ville on-chain.
   * KirhaGame brûle les tokens et crédite cityKirha[cityId].
   * Aucune approbation préalable requise (KirhaGame est minter sur KirhaToken).
   */
  const deposer = useCallback(async (montant: number) => {
    if (montant <= 0 || status === 'signing' || status === 'pending') return;
    if (montant > balanceKirha) return;
    if (!villeId || villeId === '0') return;

    setError(null);
    setStatus('signing');
    try {
      const amountWei = parseEther(montant.toFixed(6));
      setStatus('pending');
      const hash = await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'depositKirha',
        args:         [BigInt(villeId), amountWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      ajouterKirha(montant);
      await refetch();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [balanceKirha, villeId, status, writeContractAsync, publicClient, ajouterKirha, refetch]);

  return { deposer, status, error, balanceKirha };
}

import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useGameStore } from '../store/gameStore';
import { KIRHA_TOKEN_ADDRESS, KIRHA_GAME_ADDRESS } from '../contracts/addresses';

export type DepositStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export function useDeposit() {
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data: balanceWei, refetch } = useReadContract({
    address: KIRHA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balanceKirha = balanceWei ? parseFloat(formatUnits(balanceWei as bigint, 18)) : 0;

  const deposer = useCallback(async (montant: number) => {
    if (montant <= 0 || status === 'signing' || status === 'pending') return;
    if (montant > balanceKirha) return;
    setError(null);
    setStatus('signing');
    try {
      const amountWei = parseUnits(montant.toFixed(6), 18);
      setStatus('pending');
      await writeContractAsync({
        address:      KIRHA_TOKEN_ADDRESS,
        abi:          ERC20_ABI,
        functionName: 'transfer',
        args:         [KIRHA_GAME_ADDRESS, amountWei],
      });
      useGameStore.getState().ajouterKirha(montant);
      await refetch();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      setStatus('error');
    }
  }, [balanceKirha, status, writeContractAsync, refetch]);

  return { deposer, status, error, balanceKirha };
}

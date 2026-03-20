import { useState, useCallback } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import { useGameStore } from '../store/gameStore';

export const VIP_PACKS = [
  { type: 0, label: 'Petit',   pepites: 50,   kirha: 5,  bonus: '' },
  { type: 1, label: 'Moyen',   pepites: 150,  kirha: 13, bonus: '+10%' },
  { type: 2, label: 'Grand',   pepites: 400,  kirha: 32, bonus: '+25%' },
  { type: 3, label: 'Premium', pepites: 1000, kirha: 65, bonus: '+50%' },
];

export const VIP_DURATIONS = [
  { type: 0, label: '7 jours',  pepites: 100 },
  { type: 1, label: '30 jours', pepites: 300 },
  { type: 2, label: '90 jours', pepites: 700 },
];

export function useVip() {
  const [status, setStatus] = useState<'idle'|'pending'|'success'|'error'>('idle');
  const [error, setError]   = useState<string|null>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const villeId  = useGameStore(s => s.villeId);
  const setPepitesOr = useGameStore(s => s.setPepitesOr);
  const setVipExpiry = useGameStore(s => s.setVipExpiry);
  const retirerKirha = useGameStore(s => s.retirerKirha);
  const soldeKirha = useGameStore(s => s.soldeKirha);
  const pepitesOr = useGameStore(s => s.pepitesOr);

  const acheterPepites = useCallback(async (packType: number) => {
    if (!villeId || villeId === '0') return;
    const pack = VIP_PACKS[packType];
    if (!pack) return;
    if (soldeKirha < pack.kirha) { setError(`Solde insuffisant (${pack.kirha} $KIRHA requis)`); return; }
    setError(null); setStatus('pending');
    try {
      const hash = await writeContractAsync({
        address:  KIRHA_GAME_ADDRESS,
        abi:      KirhaGameAbi,
        functionName: 'buyPepites',
        args:     [BigInt(villeId), packType],
        chainId:  baseSepolia.id,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      retirerKirha(pack.kirha);
      setPepitesOr(Math.max(0, pepitesOr) + pack.pepites);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) { setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur'); setStatus('error'); }
  }, [villeId, soldeKirha, pepitesOr, writeContractAsync, publicClient, retirerKirha, setPepitesOr]);

  const acheterVip = useCallback(async (durationType: number) => {
    if (!villeId || villeId === '0') return;
    const dur = VIP_DURATIONS[durationType];
    if (!dur) return;
    if (pepitesOr < dur.pepites) { setError(`Pépites insuffisantes (${dur.pepites} requis)`); return; }
    setError(null); setStatus('pending');
    try {
      const hash = await writeContractAsync({
        address:  KIRHA_GAME_ADDRESS,
        abi:      KirhaGameAbi,
        functionName: 'buyVip',
        args:     [BigInt(villeId), durationType],
        chainId:  baseSepolia.id,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      // Sync vipExpiry from chain
      const newExpiry = await publicClient!.readContract({
        address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
        functionName: 'vipExpiry', args: [BigInt(villeId)],
      }) as bigint;
      setVipExpiry(Number(newExpiry));
      setPepitesOr(Math.max(0, pepitesOr - dur.pepites));
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) { setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur'); setStatus('error'); }
  }, [villeId, pepitesOr, writeContractAsync, publicClient, setVipExpiry, setPepitesOr]);

  return { acheterPepites, acheterVip, status, error };
}

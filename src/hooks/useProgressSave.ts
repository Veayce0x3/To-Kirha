import { useCallback, useRef } from 'react';
import { useAccount, useSignMessage, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { keccak256, stringToBytes } from 'viem';
import { useGameStore } from '../store/gameStore';
import { pickProgressForSave } from '../utils/playerProgressCodec';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

const RELAYER_URL = 'https://kirha-relayer.tokirha.workers.dev';

export function useProgressSave() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const villeId = useGameStore(s => s.villeId);
  const lastDigest = useRef<string | null>(null);

  const villeIdBn = villeId && villeId !== '0' ? BigInt(villeId) : undefined;

  const { data: relayerActive } = useReadContract({
    address:      KIRHA_GAME_ADDRESS,
    abi:          KirhaGameAbi,
    functionName: 'isRelayerActive',
    args:         villeIdBn ? [villeIdBn] : undefined,
    query:        { enabled: !!villeIdBn, refetchInterval: 120_000 },
  });

  const saveProgress = useCallback(async () => {
    if (!address || !villeId || villeId === '0') return;
    const state = useGameStore.getState();
    const picked = pickProgressForSave(state);
    const json = JSON.stringify(picked);
    const bytes = stringToBytes(json);
    const dataHex = (`0x${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}`) as `0x${string}`;
    const payloadDigest = keccak256(bytes);
    if (lastDigest.current === payloadDigest) return;

    const nonce = Date.now().toString();
    const deadline = (Math.floor(Date.now() / 1000) + 300).toString();
    const fields: Record<string, string> = {
      wallet: address.toLowerCase(),
      cityId: villeId,
      nonce,
      deadline,
      payloadDigest,
    };
    const lines = Object.keys(fields).sort().map(k => `${k}:${fields[k]}`);
    const message = ['To-Kirha Relayer', 'action:progress', ...lines].join('\n');
    const signature = await signMessageAsync({ message });

    try {
      if (relayerActive) {
        const res = await fetch(`${RELAYER_URL}/progress`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cityId: villeId,
            dataHex,
            wallet: address,
            nonce,
            deadline,
            signature,
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t.slice(0, 120));
        }
      } else {
        try {
          await switchChainAsync({ chainId: baseSepolia.id });
        } catch { /* noop */ }
        await writeContractAsync({
          address:      KIRHA_GAME_ADDRESS,
          abi:          KirhaGameAbi,
          functionName: 'setPlayerProgress',
          args:         [BigInt(villeId), bytes],
          chainId:      baseSepolia.id,
        });
      }
      lastDigest.current = payloadDigest;
    } catch (e) {
      lastDigest.current = null;
      throw e;
    }
  }, [address, villeId, signMessageAsync, relayerActive, writeContractAsync, switchChainAsync]);

  return { saveProgress };
}

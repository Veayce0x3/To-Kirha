/**
 * Purge agressive des transactions bloquées dans le mempool Base Sepolia.
 * Scanne une large plage de nonces (confirmed → confirmed+30) et envoie
 * une transaction annulation à soi-même pour chaque nonce potentiellement bloqué.
 *
 * Usage : npm run flush-nonces
 */

import { ethers } from 'hardhat';

const GAS_PRICE   = 3_000_000_000n; // 3 gwei
const SCAN_RANGE  = 30;              // nonces à scanner au-delà du confirmé

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const address = signer.address;

  const confirmedNonce = await ethers.provider.getTransactionCount(address, 'latest');
  const pendingNonce   = await ethers.provider.getTransactionCount(address, 'pending');
  const scanTo         = Math.max(pendingNonce, confirmedNonce + SCAN_RANGE);

  console.log('\n=== Flush Nonces (scan agressif) ===');
  console.log(`Wallet          : ${address}`);
  console.log(`Nonce confirmé  : ${confirmedNonce}`);
  console.log(`Nonce pending   : ${pendingNonce}`);
  console.log(`Scan jusqu\'à   : ${scanTo}\n`);

  if (scanTo <= confirmedNonce) {
    console.log('Mempool propre. Rien à purger.\n');
    return;
  }

  const sent: Array<{ nonce: number; hash: string }> = [];

  for (let nonce = confirmedNonce; nonce < scanTo; nonce++) {
    try {
      const tx = await signer.sendTransaction({
        to: address,
        value: 0n,
        nonce,
        gasPrice: GAS_PRICE,
        gasLimit: 21000n,
      });
      console.log(`  ✓ nonce ${nonce} → cancel tx: ${tx.hash}`);
      sent.push({ nonce, hash: tx.hash });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('nonce too high') || msg.includes('too high')) {
        // Nonce sans transaction bloquée → normal, on arrête le scan
        console.log(`  - nonce ${nonce} : rien à purger (nonce trop haut), arrêt du scan.`);
        break;
      }
      // Autre erreur (ex: already known) → on continue
      console.log(`  ~ nonce ${nonce} : ${msg.split('\n')[0]}`);
    }
  }

  if (sent.length === 0) {
    console.log('\nAucune transaction bloquée trouvée. Mempool propre.\n');
    return;
  }

  console.log(`\n${sent.length} transaction(s) envoyée(s), attente de confirmation...`);
  for (const { nonce, hash } of sent) {
    try {
      await ethers.provider.waitForTransaction(hash, 1, 60_000);
      console.log(`  ✓ nonce ${nonce} confirmé`);
    } catch {
      console.log(`  ⚠ nonce ${nonce} : timeout (probablement déjà traité)`);
    }
  }

  console.log('\nFlush terminé. Tu peux relancer npm run deploy:sepolia.\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

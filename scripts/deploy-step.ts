/**
 * Déploiement pas-à-pas — un contrat à la fois.
 * Chaque appel déploie UN seul contrat, attend la confirmation, puis quitte.
 * Le state est sauvegardé dans deploy-state.json pour reprendre où on en est.
 *
 * Usage :
 *   npm run deploy:step   (relancer autant de fois que nécessaire)
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE    = path.join(process.cwd(), 'deploy-state.json');
const ADDRESSES_OUT = path.join(process.cwd(), 'src/contracts/addresses.ts');
const METADATA_URI  = 'https://metadata.to-kirha.com/resources/{id}.json';
const GAS_PRICE     = 3_000_000_000n; // 3 gwei

interface State {
  kirhaToken?:     string;
  kirhaResources?: string;
  kirhaGame?:      string;
  minterSet?:      boolean;
}

function loadState(): State {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return {};
}

function saveState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function waitCleanMempool(address: string): Promise<void> {
  while (true) {
    const confirmed = await ethers.provider.getTransactionCount(address, 'latest');
    const pending   = await ethers.provider.getTransactionCount(address, 'pending');
    if (pending <= confirmed) break;
    console.log(`  Mempool: ${pending - confirmed} tx en attente... patience 10s`);
    await new Promise(r => setTimeout(r, 10_000));
  }
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const address = deployer.address;
  const state = loadState();

  console.log('\n=== To-Kirha Step Deploy ===');
  console.log('Deployer :', address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(address)), 'ETH');
  console.log('State    :', state, '\n');

  // ── Étape 1 : KirhaToken ───────────────────────────────────
  if (!state.kirhaToken) {
    await waitCleanMempool(address);
    const nonce = await ethers.provider.getTransactionCount(address, 'latest');
    console.log(`[1/4] Deploying KirhaToken... (nonce ${nonce})`);
    const Factory = await ethers.getContractFactory('KirhaToken');
    const contract = await Factory.deploy(address, { nonce, gasPrice: GAS_PRICE });
    console.log('  tx:', contract.deploymentTransaction()?.hash);
    await contract.waitForDeployment();
    state.kirhaToken = await contract.getAddress();
    saveState(state);
    console.log('  ✓ KirhaToken:', state.kirhaToken);
    console.log('\nRelance "npm run deploy:step" pour continuer.');
    return;
  }
  console.log('[1/4] KirhaToken déjà déployé :', state.kirhaToken);

  // ── Étape 2 : KirhaResources ───────────────────────────────
  if (!state.kirhaResources) {
    await waitCleanMempool(address);
    const nonce = await ethers.provider.getTransactionCount(address, 'latest');
    console.log(`[2/4] Deploying KirhaResources... (nonce ${nonce})`);
    const Factory = await ethers.getContractFactory('KirhaResources');
    const contract = await Factory.deploy(address, METADATA_URI, { nonce, gasPrice: GAS_PRICE });
    console.log('  tx:', contract.deploymentTransaction()?.hash);
    await contract.waitForDeployment();
    state.kirhaResources = await contract.getAddress();
    saveState(state);
    console.log('  ✓ KirhaResources:', state.kirhaResources);
    console.log('\nRelance "npm run deploy:step" pour continuer.');
    return;
  }
  console.log('[2/4] KirhaResources déjà déployé :', state.kirhaResources);

  // ── Étape 3 : KirhaGame ────────────────────────────────────
  if (!state.kirhaGame) {
    await waitCleanMempool(address);
    const nonce = await ethers.provider.getTransactionCount(address, 'latest');
    const backendSigner = process.env.BACKEND_SIGNER ?? address;
    console.log(`[3/4] Deploying KirhaGame... (nonce ${nonce})`);
    const Factory = await ethers.getContractFactory('KirhaGame');
    const contract = await Factory.deploy(address, state.kirhaResources, backendSigner, { nonce, gasPrice: GAS_PRICE });
    console.log('  tx:', contract.deploymentTransaction()?.hash);
    await contract.waitForDeployment();
    state.kirhaGame = await contract.getAddress();
    saveState(state);
    console.log('  ✓ KirhaGame:', state.kirhaGame);
    console.log('\nRelance "npm run deploy:step" pour continuer.');
    return;
  }
  console.log('[3/4] KirhaGame déjà déployé :', state.kirhaGame);

  // ── Étape 4 : setMinter ────────────────────────────────────
  if (!state.minterSet) {
    await waitCleanMempool(address);
    const nonce = await ethers.provider.getTransactionCount(address, 'latest');
    console.log(`[4/4] Setting minter... (nonce ${nonce})`);
    const resources = await ethers.getContractAt('KirhaResources', state.kirhaResources!);
    const tx = await (resources as any).addMinter(state.kirhaGame, { nonce, gasPrice: GAS_PRICE });
    console.log('  tx:', tx.hash);
    await tx.wait();
    state.minterSet = true;
    saveState(state);
    console.log('  ✓ KirhaGame ajouté comme minter');
  } else {
    console.log('[4/4] Minter déjà configuré');
  }

  // ── Écriture addresses.ts ──────────────────────────────────
  const network = await ethers.provider.getNetwork();
  const content = `// ============================================================
// Adresses des contrats déployés — généré par scripts/deploy-step.ts
// Réseau : ${network.name} (chainId ${network.chainId})
// Date   : ${new Date().toISOString()}
// ============================================================

/** Base Sepolia (chainId 84532) */
export const KIRHA_TOKEN_ADDRESS     = '${state.kirhaToken}' as \`0x\${string}\`;
export const KIRHA_RESOURCES_ADDRESS = '${state.kirhaResources}' as \`0x\${string}\`;
export const KIRHA_GAME_ADDRESS      = '${state.kirhaGame}' as \`0x\${string}\`;
`;
  fs.writeFileSync(ADDRESSES_OUT, content);

  console.log('\n=== Déploiement complet ===');
  console.log('KirhaToken    :', state.kirhaToken);
  console.log('KirhaResources:', state.kirhaResources);
  console.log('KirhaGame     :', state.kirhaGame);
  console.log('\nAddresses écrites dans src/contracts/addresses.ts');
  console.log('\nTu peux supprimer deploy-state.json si tu veux repartir à zéro.');
}

main().catch((err) => {
  console.error('\n❌', err.message ?? err);
  process.exitCode = 1;
});

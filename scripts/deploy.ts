import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Déploiement des contrats To-Kirha
 *
 * Ordre :
 *   1. KirhaToken
 *   2. KirhaResources
 *   3. KirhaGame      (testnet — sans vérification ECDSA)
 *   4. KirhaMarket    (HDV on-chain)
 *
 * Post-déploiement :
 *   - KirhaGame  ajouté comme minter sur KirhaResources + KirhaToken
 *   - KirhaMarket autorisé à burn/mint KirhaToken + transfert ERC-1155
 *   - Les adresses sont écrites dans src/contracts/addresses.ts
 */

const GAS_PRICE = 15_000_000_000n; // 15 gwei

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = deployer.address;

  console.log('\n=== To-Kirha Deployment ===');
  console.log('Deployer :', address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(address)), 'ETH\n');

  // Nonce séquentiel — évite les doublons dus à la latence RPC
  let nonce = await ethers.provider.getTransactionCount(address, 'pending');
  console.log('Starting nonce:', nonce);

  const METADATA_URI = 'https://metadata.to-kirha.com/resources/{id}.json';
  const TREASURY     = process.env.TREASURY_ADDRESS ?? address;

  // ── 1. KirhaToken ──────────────────────────────────────────
  console.log('Deploying KirhaToken...');
  const KirhaToken = await ethers.getContractFactory('KirhaToken');
  const kirhaToken = await KirhaToken.deploy(address, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaToken.waitForDeployment();
  const tokenAddr = await kirhaToken.getAddress();
  console.log('  KirhaToken     :', tokenAddr);

  // ── 2. KirhaResources ──────────────────────────────────────
  console.log('Deploying KirhaResources...');
  const KirhaResources = await ethers.getContractFactory('KirhaResources');
  const kirhaResources = await KirhaResources.deploy(address, METADATA_URI, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaResources.waitForDeployment();
  const resourcesAddr = await kirhaResources.getAddress();
  console.log('  KirhaResources :', resourcesAddr);

  // ── 3. KirhaGame ───────────────────────────────────────────
  console.log('Deploying KirhaGame (testnet — no ECDSA)...');
  const KirhaGame = await ethers.getContractFactory('KirhaGame');
  const kirhaGame = await KirhaGame.deploy(address, resourcesAddr, tokenAddr, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaGame.waitForDeployment();
  const gameAddr = await kirhaGame.getAddress();
  console.log('  KirhaGame      :', gameAddr);

  // ── 4. KirhaMarket ─────────────────────────────────────────
  console.log('Deploying KirhaMarket...');
  const KirhaMarket = await ethers.getContractFactory('KirhaMarket');
  const kirhaMarket = await KirhaMarket.deploy(address, resourcesAddr, tokenAddr, TREASURY, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaMarket.waitForDeployment();
  const marketAddr = await kirhaMarket.getAddress();
  console.log('  KirhaMarket    :', marketAddr);

  // ── 5. Autoriser KirhaGame comme minter ────────────────────
  console.log('\nConfiguring permissions...');
  await (kirhaResources as any).addMinter(gameAddr, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  console.log('  KirhaGame → minter on KirhaResources ✓');

  await (kirhaToken as any).addMinter(gameAddr, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  console.log('  KirhaGame → minter on KirhaToken ✓');

  // ── 6. Autoriser KirhaMarket ───────────────────────────────
  await (kirhaToken as any).addMinter(marketAddr, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  console.log('  KirhaMarket → minter on KirhaToken ✓');

  // ── 7. Écriture des adresses dans le frontend ──────────────
  const addressesPath = path.join(__dirname, '../src/contracts/addresses.ts');
  const network = await ethers.provider.getNetwork();
  const content = `// ============================================================
// Adresses des contrats déployés — généré par scripts/deploy.ts
// Réseau : ${network.name} (chainId ${network.chainId})
// Date   : ${new Date().toISOString()}
// ============================================================

/** Base Sepolia (chainId 84532) */
export const KIRHA_TOKEN_ADDRESS     = '${tokenAddr}' as \`0x\${string}\`;
export const KIRHA_RESOURCES_ADDRESS = '${resourcesAddr}' as \`0x\${string}\`;
export const KIRHA_GAME_ADDRESS      = '${gameAddr}' as \`0x\${string}\`;
export const KIRHA_MARKET_ADDRESS    = '${marketAddr}' as \`0x\${string}\`;
`;
  fs.writeFileSync(addressesPath, content);
  console.log('\nAddresses written to src/contracts/addresses.ts ✓');

  console.log('\n=== Deployment complete ===');
  console.log('KirhaToken    :', tokenAddr);
  console.log('KirhaResources:', resourcesAddr);
  console.log('KirhaGame     :', gameAddr);
  console.log('KirhaMarket   :', marketAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

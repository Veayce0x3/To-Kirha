import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Déploiement des contrats To-Kirha v2 (City NFT)
 *
 * Ordre :
 *   1. KirhaToken
 *   2. KirhaResources
 *   3. KirhaCity      (ERC-721 ville)
 *   4. KirhaGame      (toutes les données indexées par cityId)
 *   5. KirhaMarket    (HDV — opère sur les balances de ville)
 *
 * Post-déploiement :
 *   - KirhaCity.setGame(KirhaGame)
 *   - KirhaGame → minter sur KirhaResources + KirhaToken
 *   - KirhaMarket → operator sur KirhaGame + minter sur KirhaToken
 *   - KirhaGame.setTrustedRelayer(TRUSTED_RELAYER)
 *   - Les adresses sont écrites dans src/contracts/addresses.ts
 */

const GAS_PRICE = 15_000_000_000n; // 15 gwei

const TRUSTED_RELAYER = '0xe1b9eC5dB0cB6F13cF5A2357304c092c8ed4c683';

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = deployer.address;

  console.log('\n=== To-Kirha Deployment v2 (City NFT) ===');
  console.log('Deployer :', address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(address)), 'ETH\n');

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

  // ── 3. KirhaCity ───────────────────────────────────────────
  console.log('Deploying KirhaCity...');
  const KirhaCity = await ethers.getContractFactory('KirhaCity');
  const kirhaCity = await KirhaCity.deploy(address, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaCity.waitForDeployment();
  const cityAddr = await kirhaCity.getAddress();
  console.log('  KirhaCity      :', cityAddr);

  // ── 4. KirhaGame ───────────────────────────────────────────
  console.log('Deploying KirhaGame...');
  const KirhaGame = await ethers.getContractFactory('KirhaGame');
  const kirhaGame = await KirhaGame.deploy(address, resourcesAddr, tokenAddr, cityAddr, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaGame.waitForDeployment();
  const gameAddr = await kirhaGame.getAddress();
  console.log('  KirhaGame      :', gameAddr);

  // ── 5. KirhaMarket ─────────────────────────────────────────
  console.log('Deploying KirhaMarket...');
  const KirhaMarket = await ethers.getContractFactory('KirhaMarket');
  const kirhaMarket = await KirhaMarket.deploy(address, tokenAddr, cityAddr, gameAddr, TREASURY, {
    nonce: nonce++, gasPrice: GAS_PRICE,
  });
  await kirhaMarket.waitForDeployment();
  const marketAddr = await kirhaMarket.getAddress();
  console.log('  KirhaMarket    :', marketAddr);

  // ── 6. KirhaCity.setGame ────────────────────────────────────
  console.log('\nConfiguring KirhaCity...');
  await (kirhaCity as any).setGame(gameAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaCity.setGame(KirhaGame) ✓');

  // ── 7. Permissions KirhaGame ────────────────────────────────
  console.log('\nConfiguring permissions...');
  await (kirhaResources as any).addMinter(gameAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaGame → minter on KirhaResources ✓');

  await (kirhaToken as any).addMinter(gameAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaGame → minter on KirhaToken ✓');

  // ── 8. Permissions KirhaMarket ──────────────────────────────
  await (kirhaGame as any).setOperator(marketAddr, true, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaMarket → operator on KirhaGame ✓');

  await (kirhaToken as any).addMinter(marketAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaMarket → minter on KirhaToken ✓');

  // ── 9. Trusted Relayer ──────────────────────────────────────
  console.log('\nConfiguring trusted relayer...');
  await (kirhaGame as any).setTrustedRelayer(TRUSTED_RELAYER, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaGame.setTrustedRelayer(' + TRUSTED_RELAYER + ') ✓');

  // ── 10. Écriture des adresses ───────────────────────────────
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
export const KIRHA_CITY_ADDRESS      = '${cityAddr}' as \`0x\${string}\`;
export const KIRHA_GAME_ADDRESS      = '${gameAddr}' as \`0x\${string}\`;
export const KIRHA_MARKET_ADDRESS    = '${marketAddr}' as \`0x\${string}\`;
`;
  fs.writeFileSync(addressesPath, content);
  console.log('\nAddresses written to src/contracts/addresses.ts ✓');

  console.log('\n=== Deployment complete ===');
  console.log('KirhaToken    :', tokenAddr);
  console.log('KirhaResources:', resourcesAddr);
  console.log('KirhaCity     :', cityAddr);
  console.log('KirhaGame     :', gameAddr);
  console.log('KirhaMarket   :', marketAddr);
  console.log('TrustedRelayer:', TRUSTED_RELAYER);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

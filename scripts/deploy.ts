import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Déploiement des contrats To-Kirha
 *
 * Ordre :
 *   1. KirhaToken
 *   2. KirhaResources
 *   3. KirhaGame  (reçoit l'adresse de KirhaResources)
 *
 * Post-déploiement :
 *   - KirhaGame est ajouté comme minter sur KirhaResources
 *   - Les adresses sont écrites dans src/contracts/addresses.ts
 *
 * Usage :
 *   npx hardhat run scripts/deploy.ts --network base-sepolia
 */

const GAS_PRICE = 3_000_000_000n; // 3 gwei

/** Récupère le nonce confirmé on-chain (évite les conflits de cache Hardhat) */
async function getNonce(address: string): Promise<number> {
  return ethers.provider.getTransactionCount(address, 'latest');
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = deployer.address;

  console.log('\n=== To-Kirha Deployment ===');
  console.log('Deployer :', address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(address)), 'ETH\n');

  const METADATA_URI = 'https://metadata.to-kirha.com/resources/{id}.json';
  const BACKEND_SIGNER = process.env.BACKEND_SIGNER ?? address;

  // ── 1. KirhaToken ──────────────────────────────────────────
  console.log('Deploying KirhaToken...');
  const KirhaToken = await ethers.getContractFactory('KirhaToken');
  const kirhaToken = await KirhaToken.deploy(address, {
    nonce: await getNonce(address),
    gasPrice: GAS_PRICE,
  });
  await kirhaToken.waitForDeployment();
  const tokenAddr = await kirhaToken.getAddress();
  console.log('  KirhaToken deployed    :', tokenAddr);

  // ── 2. KirhaResources ──────────────────────────────────────
  console.log('Deploying KirhaResources...');
  const KirhaResources = await ethers.getContractFactory('KirhaResources');
  const kirhaResources = await KirhaResources.deploy(address, METADATA_URI, {
    nonce: await getNonce(address),
    gasPrice: GAS_PRICE,
  });
  await kirhaResources.waitForDeployment();
  const resourcesAddr = await kirhaResources.getAddress();
  console.log('  KirhaResources deployed:', resourcesAddr);

  // ── 3. KirhaGame ───────────────────────────────────────────
  console.log('Deploying KirhaGame...');
  const KirhaGame = await ethers.getContractFactory('KirhaGame');
  const kirhaGame = await KirhaGame.deploy(address, resourcesAddr, BACKEND_SIGNER, {
    nonce: await getNonce(address),
    gasPrice: GAS_PRICE,
  });
  await kirhaGame.waitForDeployment();
  const gameAddr = await kirhaGame.getAddress();
  console.log('  KirhaGame deployed     :', gameAddr);

  // ── 4. Autoriser KirhaGame comme minter ────────────────────
  console.log('\nConfiguring minters...');
  await (kirhaResources as any).addMinter(gameAddr, {
    nonce: await getNonce(address),
    gasPrice: GAS_PRICE,
  });
  console.log('  KirhaGame added as minter on KirhaResources');

  // ── 5. Écriture des adresses dans le frontend ──────────────
  const addressesPath = path.join(__dirname, '../src/contracts/addresses.ts');
  const content = `// ============================================================
// Adresses des contrats déployés — généré par scripts/deploy.ts
// Réseau : ${(await ethers.provider.getNetwork()).name}
// Date   : ${new Date().toISOString()}
// ============================================================

/** Base Sepolia (chainId 84532) */
export const KIRHA_TOKEN_ADDRESS     = '${tokenAddr}' as \`0x\${string}\`;
export const KIRHA_RESOURCES_ADDRESS = '${resourcesAddr}' as \`0x\${string}\`;
export const KIRHA_GAME_ADDRESS      = '${gameAddr}' as \`0x\${string}\`;
`;

  fs.writeFileSync(addressesPath, content);
  console.log('\nAddresses written to src/contracts/addresses.ts');

  console.log('\n=== Deployment complete ===');
  console.log('KirhaToken    :', tokenAddr);
  console.log('KirhaResources:', resourcesAddr);
  console.log('KirhaGame     :', gameAddr);
  console.log('\nTo verify on Basescan:');
  console.log(`  npx hardhat verify --network base-sepolia ${tokenAddr} "${address}"`);
  console.log(`  npx hardhat verify --network base-sepolia ${resourcesAddr} "${address}" "${METADATA_URI}"`);
  console.log(`  npx hardhat verify --network base-sepolia ${gameAddr} "${address}" "${resourcesAddr}" "${BACKEND_SIGNER}"`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

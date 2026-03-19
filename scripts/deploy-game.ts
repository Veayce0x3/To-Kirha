import { ethers } from 'hardhat';

/**
 * Redéploie uniquement KirhaGame (garde KirhaToken, KirhaResources, KirhaMarket inchangés).
 * Met à jour les permissions minter.
 */

const GAS_PRICE = 15_000_000_000n; // 15 gwei

// Adresses existantes (à ne pas redéployer)
const KIRHA_TOKEN_ADDRESS     = '0x7DF9F321829c9096622D81E640968e601e43a025';
const KIRHA_RESOURCES_ADDRESS = '0x581334a6725C5A6057cF63283655eb38AC1cA295';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('\n=== Redeploy KirhaGame ===');
  console.log('Deployer :', deployer.address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  let nonce = await ethers.provider.getTransactionCount(deployer.address, 'pending');

  // ── Déployer nouveau KirhaGame ──────────────────────────────
  console.log('Deploying KirhaGame...');
  const KirhaGame = await ethers.getContractFactory('KirhaGame');
  const kirhaGame = await KirhaGame.deploy(
    deployer.address,
    KIRHA_RESOURCES_ADDRESS,
    KIRHA_TOKEN_ADDRESS,
    { nonce: nonce++, gasPrice: GAS_PRICE }
  );
  await kirhaGame.waitForDeployment();
  const gameAddr = await kirhaGame.getAddress();
  console.log('  KirhaGame :', gameAddr);

  // ── Configurer permissions ──────────────────────────────────
  console.log('\nConfiguring permissions...');

  const resourcesAbi = ['function addMinter(address) external'];
  const tokenAbi     = ['function addMinter(address) external'];

  const resources = new ethers.Contract(KIRHA_RESOURCES_ADDRESS, resourcesAbi, deployer);
  const token     = new ethers.Contract(KIRHA_TOKEN_ADDRESS,     tokenAbi,     deployer);

  await resources.addMinter(gameAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaGame → minter on KirhaResources ✓');

  await token.addMinter(gameAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaGame → minter on KirhaToken ✓');

  console.log('\n=== Done ===');
  console.log('New KIRHA_GAME_ADDRESS:', gameAddr);
  console.log('\nUpdate src/contracts/addresses.ts with:');
  console.log(`export const KIRHA_GAME_ADDRESS = '${gameAddr}' as \`0x\${string}\`;`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });

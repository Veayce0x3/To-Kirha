import { ethers } from 'hardhat';

/**
 * Redéploie uniquement KirhaMarket (garde les autres contrats inchangés).
 * Ajoute les permissions minter sur KirhaToken.
 */

const GAS_PRICE = 15_000_000_000n; // 15 gwei

const KIRHA_TOKEN_ADDRESS     = '0x7DF9F321829c9096622D81E640968e601e43a025';
const KIRHA_CITY_ADDRESS      = '0x65545059D2E87cae0737237E43dfAf835bf08b83';
const KIRHA_GAME_ADDRESS      = '0x898bf53dC0E8DcE3A9De5fD48F996328BF651C5f';
const TREASURY_ADDRESS        = '0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C'; // deployer wallet = treasury

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('\n=== Redeploy KirhaMarket ===');
  console.log('Deployer :', deployer.address);
  console.log('Balance  :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  let nonce = await ethers.provider.getTransactionCount(deployer.address, 'pending');

  // ── Déployer nouveau KirhaMarket ────────────────────────────
  console.log('Deploying KirhaMarket...');
  const KirhaMarket = await ethers.getContractFactory('KirhaMarket');
  const kirhaMarket = await KirhaMarket.deploy(
    deployer.address,
    KIRHA_TOKEN_ADDRESS,
    KIRHA_CITY_ADDRESS,
    KIRHA_GAME_ADDRESS,
    TREASURY_ADDRESS,
    { nonce: nonce++, gasPrice: GAS_PRICE }
  );
  await kirhaMarket.waitForDeployment();
  const marketAddr = await kirhaMarket.getAddress();
  console.log('  KirhaMarket :', marketAddr);

  // ── Configurer permissions ──────────────────────────────────
  console.log('\nConfiguring permissions...');
  const tokenAbi = ['function addMinter(address) external'];
  const token    = new ethers.Contract(KIRHA_TOKEN_ADDRESS, tokenAbi, deployer);

  await token.addMinter(marketAddr, { nonce: nonce++, gasPrice: GAS_PRICE });
  console.log('  KirhaMarket → minter on KirhaToken ✓');

  console.log('\n=== Done ===');
  console.log('New KIRHA_MARKET_ADDRESS:', marketAddr);
  console.log('\nUpdate src/contracts/addresses.ts with:');
  console.log(`export const KIRHA_MARKET_ADDRESS = '${marketAddr}' as \`0x\${string}\`;`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });

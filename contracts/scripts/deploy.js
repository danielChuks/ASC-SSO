const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const CommitmentRegistry = await hre.ethers.getContractFactory("CommitmentRegistry");
  const registry = await CommitmentRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("CommitmentRegistry deployed to:", address);
  console.log("\nAdd to backend/.env:");
  console.log(`IDR_CONTRACT_ADDRESS=${address}`);
  console.log(`ETH_RPC_URL=http://127.0.0.1:8545`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

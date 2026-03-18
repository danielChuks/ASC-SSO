const hre = require("hardhat");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(value).trim();
}

async function main() {
  if (hre.network.name !== "sepolia") {
    throw new Error("Run this script with --network sepolia");
  }

  const rpc = requireEnv("SEPOLIA_RPC_URL");
  const deployerPrivateKey = requireEnv("SEPOLIA_DEPLOYER_PRIVATE_KEY");
  const relayerAddress = requireEnv("DAO_VOTE_RELAYER_ADDRESS");

  if (!hre.ethers.isAddress(relayerAddress)) {
    throw new Error("DAO_VOTE_RELAYER_ADDRESS must be a valid address");
  }
  if (!(deployerPrivateKey.startsWith("0x") && deployerPrivateKey.length === 66)) {
    throw new Error("SEPOLIA_DEPLOYER_PRIVATE_KEY must be 0x + 64 hex chars");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Network:", hre.network.name);
  console.log("RPC:", rpc);
  console.log("Deployer:", deployer.address);
  console.log("Relayer address:", relayerAddress);

  const CommitmentRegistry = await hre.ethers.getContractFactory("CommitmentRegistry");
  const registry = await CommitmentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  const DAOVoting = await hre.ethers.getContractFactory("DAOVoting");
  const daoVoting = await DAOVoting.deploy(relayerAddress);
  await daoVoting.waitForDeployment();
  const daoAddress = await daoVoting.getAddress();

  console.log("\nCommitmentRegistry deployed to:", registryAddress);
  console.log("DAOVoting deployed to:", daoAddress);
  console.log("\nUpdate:");
  console.log(`backend/.env -> ETH_RPC_URL=${rpc}`);
  console.log(`backend/.env -> IDR_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`backend/.env -> DAO_VOTING_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`backend/.env -> DAO_VOTE_RELAYER_ADDRESS=${relayerAddress}`);
  console.log("backend/.env -> DAO_VOTE_RELAYER=0x... (private key for relayer)");
  console.log("backend/.env -> IDR_DEPLOYER_KEY=0x... (private key for commitment writer)");
  console.log(`frontend/master-wallet/.env.local -> NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS=${daoAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const hre = require("hardhat");

async function main() {
  const [deployer, defaultRelayer] = await hre.ethers.getSigners();
  const voteRelayerAddress = process.env.DAO_VOTE_RELAYER_ADDRESS || defaultRelayer.address;
  if (!hre.ethers.isAddress(voteRelayerAddress)) {
    throw new Error("DAO_VOTE_RELAYER_ADDRESS must be a valid address");
  }

  console.log("Deploying with account:", deployer.address);
  console.log("Vote relayer address:", voteRelayerAddress);

  const CommitmentRegistry = await hre.ethers.getContractFactory("CommitmentRegistry");
  const registry = await CommitmentRegistry.deploy();
  await registry.waitForDeployment();

  const DAOVoting = await hre.ethers.getContractFactory("DAOVoting");
  const daoVoting = await DAOVoting.deploy(voteRelayerAddress);
  await daoVoting.waitForDeployment();

  const registryAddress = await registry.getAddress();
  const daoVotingAddress = await daoVoting.getAddress();

  console.log("CommitmentRegistry deployed to:", registryAddress);
  console.log("DAOVoting deployed to:", daoVotingAddress);
  console.log("\nAdd to backend/.env:");
  console.log(`IDR_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`DAO_VOTING_CONTRACT_ADDRESS=${daoVotingAddress}`);
  console.log("DAO_VOTE_RELAYER=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log(`ETH_RPC_URL=http://127.0.0.1:8545`);
  console.log(`DAO_VOTE_RELAYER_ADDRESS=${voteRelayerAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

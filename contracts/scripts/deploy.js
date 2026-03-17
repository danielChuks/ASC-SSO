const hre = require("hardhat");

async function main() {
  const [deployer, defaultRelayer] = await hre.ethers.getSigners();
  const voteRelayer = process.env.DAO_VOTE_RELAYER || defaultRelayer.address;

  console.log("Deploying with account:", deployer.address);
  console.log("Vote relayer:", voteRelayer);

  const CommitmentRegistry = await hre.ethers.getContractFactory("CommitmentRegistry");
  const registry = await CommitmentRegistry.deploy();
  await registry.waitForDeployment();

  const DAOVoting = await hre.ethers.getContractFactory("DAOVoting");
  const daoVoting = await DAOVoting.deploy(voteRelayer);
  await daoVoting.waitForDeployment();

  const registryAddress = await registry.getAddress();
  const daoVotingAddress = await daoVoting.getAddress();

  console.log("CommitmentRegistry deployed to:", registryAddress);
  console.log("DAOVoting deployed to:", daoVotingAddress);
  console.log("\nAdd to backend/.env:");
  console.log(`IDR_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`DAO_VOTING_CONTRACT_ADDRESS=${daoVotingAddress}`);
  console.log(`DAO_VOTE_RELAYER=${voteRelayer}`);
  console.log(`ETH_RPC_URL=http://127.0.0.1:8545`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

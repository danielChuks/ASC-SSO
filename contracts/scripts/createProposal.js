const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnvDefaults() {
  const contractsEnv = path.resolve(__dirname, "../.env");
  const backendEnv = path.resolve(__dirname, "../../backend/.env");
  loadEnvFile(contractsEnv);
  loadEnvFile(backendEnv);
}

function readArg(name, fallback = "") {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

async function main() {
  loadEnvDefaults();

  const contractAddress = readArg("DAO_VOTING_CONTRACT_ADDRESS");
  const proposalIdRaw = readArg("PROPOSAL_ID");
  const description = readArg("PROPOSAL_DESCRIPTION");
  const startTimeRaw = readArg("PROPOSAL_START_TIME");
  const endTimeRaw = readArg("PROPOSAL_END_TIME");
  const snapshotRootRaw = readArg("PROPOSAL_SNAPSHOT_ROOT");

  if (!contractAddress) {
    throw new Error("Missing DAO_VOTING_CONTRACT_ADDRESS in environment");
  }
  if (!proposalIdRaw) {
    throw new Error("Missing PROPOSAL_ID in environment");
  }
  if (!description) {
    throw new Error("Missing PROPOSAL_DESCRIPTION in environment");
  }
  if (!startTimeRaw || !endTimeRaw) {
    throw new Error("Missing PROPOSAL_START_TIME or PROPOSAL_END_TIME in environment");
  }

  const proposalId = parsePositiveInt(proposalIdRaw, "PROPOSAL_ID");
  const startTime = parsePositiveInt(startTimeRaw, "PROPOSAL_START_TIME");
  const endTime = parsePositiveInt(endTimeRaw, "PROPOSAL_END_TIME");
  if (endTime <= startTime) {
    throw new Error("PROPOSAL_END_TIME must be greater than PROPOSAL_START_TIME");
  }

  const [ownerSigner] = await hre.ethers.getSigners();
  const daoVoting = await hre.ethers.getContractAt("DAOVoting", contractAddress, ownerSigner);

  const snapshotRoot = snapshotRootRaw
    ? snapshotRootRaw
    : hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`proposal-${proposalId}-snapshot`));

  console.log("Using owner signer:", ownerSigner.address);
  console.log("Contract:", contractAddress);
  console.log("proposalId:", proposalId);
  console.log("description:", description);
  console.log("startTime:", startTime);
  console.log("endTime:", endTime);
  console.log("snapshotRoot:", snapshotRoot);

  const tx = await daoVoting.createProposal(
    BigInt(proposalId),
    description,
    snapshotRoot,
    BigInt(startTime),
    BigInt(endTime)
  );
  console.log("Submitted tx:", tx.hash);

  const receipt = await tx.wait();
  const status = receipt?.status;
  const succeeded = status === 1 || status === 1n;
  if (!succeeded) {
    throw new Error(`createProposal transaction failed (status=${String(status)})`);
  }
  console.log("Proposal created successfully. Tx:", receipt.transactionHash);
}

main().catch((err) => {
  const message = err?.shortMessage || err?.message || String(err);
  if (message.includes("ProposalAlreadyExists") || message.includes("Proposal already exists")) {
    console.error("Proposal already exists on-chain. Try a different PROPOSAL_ID.");
  } else {
    console.error(err);
  }
  process.exit(1);
});

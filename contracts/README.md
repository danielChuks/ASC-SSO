# Lantra Contracts

Solidity contracts for Lantra:

- **CommitmentRegistry** — On-chain IdR for identity commitments. The backend **requires** this for registry endpoints.
- **DAOVoting** — On-chain proposals and vote tallies. Optional; enables `GET /dao/proposals` and `POST /dao/vote` when configured.

## Prerequisites

- Node.js 18+
- Hardhat

## Setup

```bash
cd contracts
npm install
```

## Compile

```bash
npm run compile
```

## Deploy

1. **Start a local Ethereum node** (keep it running):

   ```bash
   npx hardhat node
   ```

   This prints accounts and private keys. Copy one private key (e.g. Account #0) for `IDR_DEPLOYER_KEY`.

2. **Deploy the contracts** (in a second terminal):

   ```bash
   npm run deploy:local
   ```

   Copy the printed addresses. The deploy script outputs both CommitmentRegistry and DAOVoting.

3. **Add to `backend/.env`**:

   ```
   IDR_CONTRACT_ADDRESS=0x...
   DAO_VOTING_CONTRACT_ADDRESS=0x...
   DAO_VOTE_RELAYER=0x...   # Private key of vote relayer (from deploy output)
   ETH_RPC_URL=http://127.0.0.1:8545
   IDR_DEPLOYER_KEY=0x...   # Private key from step 1
   ```

## Backend Integration

**CommitmentRegistry** — The backend uses it for:

- `POST /registry/register` — add commitment (requires `IDR_DEPLOYER_KEY` for gas)
- `GET /registry/check/{commitment}` — check existence
- `GET /registry/group` — get Semaphore commitments for ZK anonymity set

**DAOVoting** — When `DAO_VOTING_CONTRACT_ADDRESS` and `DAO_VOTE_RELAYER` are set:

- `GET /dao/proposals` — list proposals
- `POST /dao/vote` — verify proof, check nullifier, relay to `castVote()`

Without IdR env vars, registry endpoints return 503. DAO endpoints return 503 if not configured.

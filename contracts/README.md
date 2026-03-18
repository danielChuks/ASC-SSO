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

## Deploy to Sepolia

1. **Create `contracts/.env`** (copy from `.env.example`):

   ```
   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   SEPOLIA_DEPLOYER_PRIVATE_KEY=0x...   # 0x + 64 hex chars (private key, NOT address)
   DAO_VOTE_RELAYER_ADDRESS=0x...       # Address that will relay votes (e.g. deployer or backend relayer)
   ```

   **Getting the values:**
   - `SEPOLIA_RPC_URL` — Use public node above, or Infura/Alchemy with your key
   - `SEPOLIA_DEPLOYER_PRIVATE_KEY` — Export from MetaMask (Account details → Show private key). Must be 64 hex chars after `0x`. An address (40 chars) will not work.
   - `DAO_VOTE_RELAYER_ADDRESS` — The address that will call `castVote`. Can be the deployer's address, or the address of the backend relayer (derived from `DAO_VOTE_RELAYER` private key)

2. **Fund the deployer** — Get Sepolia ETH from a faucet (e.g. [sepoliafaucet.com](https://sepoliafaucet.com))

3. **Deploy**:

   ```bash
   npm run deploy:dao:sepolia
   ```

4. **Update `backend/.env`** with the printed values:

   ```
   ETH_RPC_URL=<SEPOLIA_RPC_URL from step 1>
   IDR_CONTRACT_ADDRESS=<from deploy output>
   DAO_VOTING_CONTRACT_ADDRESS=<from deploy output>
   DAO_VOTE_RELAYER_ADDRESS=<from deploy output>
   IDR_DEPLOYER_KEY=0x...   # Same private key as SEPOLIA_DEPLOYER_PRIVATE_KEY (or separate commitment writer)
   DAO_VOTE_RELAYER=0x...   # Private key for the relayer address (castVote)
   ```

5. **Update `frontend/master-wallet/.env.local`**:

   ```
   NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS=<DAO_VOTING_CONTRACT_ADDRESS from deploy output>
   NEXT_PUBLIC_DAO_CHAIN_ID=11155111
   ```

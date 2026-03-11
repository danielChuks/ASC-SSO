# CommitmentRegistry (On-chain IdR)

Solidity contract for storing identity commitments. The backend **requires** this contract for the IdR — commitments are stored on-chain only (no PostgreSQL).

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

2. **Deploy the contract** (in a second terminal):

   ```bash
   npm run deploy:local
   ```

   Copy the printed contract address.

3. **Add to `backend/.env`**:

   ```
   IDR_CONTRACT_ADDRESS=0x...
   ETH_RPC_URL=http://127.0.0.1:8545
   IDR_DEPLOYER_KEY=0x...   # Private key from step 1
   ```

## Backend Integration

The backend uses the contract for:

- `POST /registry/register` — add commitment (requires `IDR_DEPLOYER_KEY` for gas)
- `GET /registry/check/{commitment}` — check existence
- `GET /registry/group` — get Semaphore commitments for ZK anonymity set

Without these env vars, registry endpoints return 503.

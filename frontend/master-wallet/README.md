# Lantra Master Wallet

Next.js app for anonymous identity, SP authentication, and DAO voting.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Config

Create `.env.local` from `.env.local.example`. Required:

- `NEXT_PUBLIC_API_URL` — Backend URL (default: `http://localhost:8000`)

For DAO: `NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS`, `NEXT_PUBLIC_DAO_CHAIN_ID` (31337 local, 11155111 Sepolia).

## Flow

1. **Create Identity** — Generate Semaphore identity, register commitments on-chain
2. **Login to Lantra** — Register (ZK proof) or login (Gauth signature); SP URL defaults to app origin
3. **DAO Voting** — View proposals, vote Yes/No/Abstain; owner can create and finalize proposals

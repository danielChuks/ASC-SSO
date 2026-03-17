# Lantra Master Wallet

Next.js app for anonymous identity, SP authentication, and DAO voting.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Config

Set `NEXT_PUBLIC_API_URL` in `.env.local` (default: `http://localhost:8000`).

## Flow

1. **Create Identity** — Generate Semaphore identity, register commitments on-chain
2. **Login to Site** — Enter SP URL, register (ZK proof) or login (Gauth signature)
3. **DAO Voting** — View proposals, vote Yes/No/Abstain with ZK proof

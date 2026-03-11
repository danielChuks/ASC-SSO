# ShieldLogin Master Wallet

Next.js app for creating identities and authenticating to Service Providers.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Config

Set `NEXT_PUBLIC_API_URL` in `.env.local` (default: `http://localhost:8000`).

## Flow

1. **Create Identity** — Generate msk, register commitment with backend
2. **Login to Site** — Enter SP URL, get nonce, create proof + nullifier, verify credential

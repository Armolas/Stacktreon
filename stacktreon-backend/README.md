# Stacktreon Backend

NestJS API for [Stacktreon](https://github.com/Armolas/Stacktreon), a creator monetization platform on Stacks. It manages creators, content, subscriptions, and transactions, stores files in Supabase Storage, and enforces x402 pay-per-view payments on premium content.

## How it works

- **Creators** register a profile tied to their Stacks wallet address and set a monthly subscription fee.
- **Content** uploads go to Supabase Storage; files are served back through short-lived signed URLs (1 hour). Premium content (price > 0) never exposes its URL to non-payers.
- **Pay-per-view** requests to `GET /content/x402/:id` pass through the `X402Guard`, which uses [x402-stacks](https://www.npmjs.com/package/x402-stacks) to respond with `402 Payment Required` and verify STX payments through a facilitator before releasing the signed URL.
- **Subscriptions** are recorded when a subscription transaction is marked confirmed, granting 30 days of access.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/creators/register` | Register a creator profile |
| GET | `/creators` | List all creators |
| GET | `/creators/wallet/:walletAddress` | Get creator by wallet |
| GET | `/creators/username/:username` | Get creator by username |
| GET | `/creators/:id` | Get creator by id |
| POST | `/content/:creatorId/upload` | Upload content (multipart) |
| GET | `/content` | List content |
| GET | `/content/creator/:creatorId` | List a creator's content |
| GET | `/content/:id` | Get content (locked items return no file URL) |
| GET | `/content/x402/:id` | Pay-per-view access, guarded by x402 |
| PUT | `/content/:id` | Update content |
| DELETE | `/content/:id` | Delete content |
| GET | `/subscriptions/status` | Check a fan's subscription to a creator |
| GET | `/subscriptions/creator/:creatorId` | List a creator's subscribers |
| GET | `/subscriptions/user/:walletAddress` | List a fan's subscriptions |
| POST | `/transactions` | Record a transaction |
| PUT | `/transactions/:id/status` | Update transaction status |
| GET | `/transactions/creator/:walletAddress` | Transactions received by a creator |
| GET | `/transactions/wallet/:walletAddress` | Transactions sent by a wallet |

Known limitations (server-side transaction verification, endpoint auth) are tracked in the root README's Status & Roadmap section.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run start:dev
```

The API listens on `PORT` (default 3000).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `FRONTEND_URL` | Extra origin allowed by CORS |
| `PORT` | HTTP port (default 3000) |
| `NETWORK` | `testnet` or `mainnet` for x402 verification |
| `FACILITATOR_URL` | x402 facilitator endpoint |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `SUPABASE_BUCKET` | Storage bucket for uploads |

## Tests

```bash
npm test
```

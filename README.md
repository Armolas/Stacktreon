# Stacktreon Platform Monorepo

Stacktreon blends recurring memberships with x402-powered pay-per-view moments so creators can earn STX directly from fans. This repository houses every layer—from the marketing/front-office app to the NestJS API and on-chain Clarity contract—so the whole experience can be iterated in lockstep.

## Repository Layout
| Path | Description | Key Tech |
| --- | --- | --- |
| `content-creator-hub/` | Vite + React + TypeScript front-end that serves the marketing site, creator tools, and fan dashboards. | React 18, TanStack Query, shadcn/ui, Tailwind, @stacks/connect |
| `stacktreon-backend/` | NestJS API backing creators, content, subscriptions, transactions, storage, and x402 payments. | Nest 11, TypeORM + Postgres, Supabase Storage, x402-stacks |
| `stacktreon-contract/` | Clarity smart contract that enforces 30-day subscriptions on Stacks and exposes read-only helpers. | Clarinet, Vitest, @stacks/transactions |

## End-to-End Capabilities
- **Wallet-aware UX:** `WalletProvider` keeps browser state in sync with Stacks Connect so the front-end knows when to surface CTAs, run contract calls, or unlock files.
- **Creator & fan consoles:** React routers cover `/explore`, `/creator/:handle`, `/content/:id`, `/dashboard/creator`, `/dashboard/fan`, plus onboarding/upload flows with analytics fed by the backend API.
- **Content security:** Files upload through Supabase Storage, serve back via short-lived signed URLs, and premium items require either an active subscription (verified through the API) or a one-off x402 payment.
- **Subscriptions + PPV accounting:** The backend records every transaction and automatically mints subscription rows once blockchain confirmations arrive, keeping REST data aligned with Clarity state.
- **On-chain guardrails:** `stacktreon-contract` defines registration, subscription, withdrawal, and fee updates with STX transfers and expiry logic baked in.

## Prerequisites
- Node.js 18.18+ (or 20+) and npm 9+ (pnpm/Bun optional for the front-end).
- Postgres database reachable via `DATABASE_URL` (Neon, Supabase, local, etc.).
- Supabase project (for content uploads) or compatible S3-like storage.
- Clarinet CLI (`npm install -g @hirosystems/clarinet`) for contract builds/tests.
- A Stacks wallet (Leather/Hiro) configured for testnet transactions.

## Getting Started
1. **Install dependencies**
   ```bash
   npm install --prefix content-creator-hub
   npm install --prefix stacktreon-backend
   npm install --prefix stacktreon-contract
   ```
2. **Configure environment variables** (see [Environment](#environment)).
3. **Start services**
   ```bash
   # terminal 1 – API
   cd stacktreon-backend
   npm run start:dev

   # terminal 2 – Front-end
   cd content-creator-hub
   npm run dev

   # optional – contract tests / clarinet console
   cd stacktreon-contract
   clarinet console
   ```
4. Visit `http://localhost:5173` (default Vite port) to use the UI against `http://localhost:3000` (NestJS default).

## Package Notes
### `content-creator-hub`
- **Routing & providers:** `src/App.tsx` wires the theme, TanStack Query, wallet context, toasters, and React Router paths.
- **API client:** `src/lib/api.ts` centralizes REST helpers for creators, content, subscriptions, and ledgering transactions.
- **x402 client:** `src/lib/x402Client.ts` retries paywalled endpoints, opens STX transfers, polls the Hiro API for raw TX data, and attaches payment signatures per the x402 spec.
- **Commands:** `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm run test`, `npm run test:watch`.

### `stacktreon-backend`
- **Modules:** `Creators`, `Content`, `Subscriptions`, `Transactions`, `Storage`, plus an `X402Guard` that enforces pay-per-view pricing on `GET /content/x402/:id`.
- **Storage pipeline:** Uploads stream through Supabase service-role credentials; all download links are signed per request.
- **Subscriptions lifecycle:** `TransactionsService.updateTransactionStatus` confirms blockchain hashes and then calls `SubscriptionsService.createSubscription`, ensuring a 30-day window is inserted server-side.
- **Security:** Global validation pipe with DTOs protects all payloads; CORS limited via `FRONTEND_URL`.
- **Commands:** `npm run start:dev`, `npm run start`, `npm run start:prod`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`.

### `stacktreon-contract`
- **Contract (`contracts/stacktreonv1.clar`):**
  - `register-creator` sets an initial fee and zeroes earnings.
  - `subscribe` transfers STX, records totals/balances, and stamps a 30-day expiry.
  - `withdraw-creator-earning` lets creators pull down accumulated microSTX.
  - `update-subscription-fee` and `is-active-subscriber` cover pricing changes and read-only validation.
- **Testing:** Run `npm test` (Vitest + Clarinet harness) or `npm run test:watch` to rerun on file changes.

## Environment
Create `.env` files inside each package (`VITE_*` values for the front-end, standard dotenv for backend). Key variables:

| Service | Variable | Purpose | Default |
| --- | --- | --- | --- |
| Front-end | `VITE_API_URL` | Base URL for the NestJS API. | `http://localhost:3000` |
| Front-end | `VITE_NETWORK` | `mainnet` or `testnet` for wallet + x402 clients. | `testnet` |
| Front-end | `VITE_CONTRACT_ADDRESS` / `VITE_CONTRACT_NAME` | Clarity contract coordinates for `useSubscriptionContract`. | `ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E` / `stacktreonv1` |
| Backend | `DATABASE_URL` | Postgres connection for TypeORM. | – |
| Backend | `PORT` | HTTP port (defaults to `3000`). | `3000` |
| Backend | `FRONTEND_URL` | Allowed origin for CORS. | `http://localhost:5173` |
| Backend | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` | Credentials for file uploads + signed downloads. | – |
| Backend | `NETWORK` | Stacks network for x402 + contract alignment. | `testnet` |
| Backend | `FACILITATOR_URL` | Optional x402 facilitator override. | `https://facilitator.stacksx402.com` |
| Contracts | `CLARINET_REQUIREMENTS` | Managed by Clarinet; no manual vars required. | – |

## Testing & Quality Gates
- **Front-end:** `npm run test` (Vitest) + `npm run lint` before shipping UI changes.
- **Backend:** `npm run test`, `npm run test:e2e`, and `npm run lint` ensure DTOs/controllers are covered.
- **Contracts:** `npm test` compiles + runs Clarinet simulations; add more cases under `tests/` to capture new contract paths.

## Deployment Checklist
1. Deploy the Clarity contract and update `VITE_CONTRACT_*` plus backend references.
2. Provision database/storage secrets per environment (`.env.production`, GitHub Actions secrets, etc.).
3. CI pipeline should run `npm run build` in each package; deploy artifacts to your hosting provider (e.g., Vercel/Netlify for the front-end, Fly.io/Render for Nest, Hiro mainnet for contracts).
4. Revoke and rotate Supabase service keys if the repo becomes public.

## Contributing
- Branch off `main`, keep commits scoped, and include tests for behavior changes.
- Document new endpoints or contract exports in this README (and module-level READMEs if needed).
- Open a PR that runs `npm run lint && npm run test` in every affected package before requesting review.



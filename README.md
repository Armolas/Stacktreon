# Stacktreon Platform Monorepo

Stacktreon blends recurring memberships with x402-powered pay-per-view moments so creators can earn STX directly from fans. This repository houses every layer, from the web app and its Convex backend to the on-chain Clarity contract, so the whole experience can be iterated in lockstep.

**Live demo (testnet):** https://stacktreon.vercel.app · Contract: `ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E.stacktreonv1`

## Repository Layout
| Path | Description | Key Tech |
| --- | --- | --- |
| `content-creator-hub/` | Vite + React + TypeScript front-end plus the Convex backend (`convex/`): database, file storage, HTTP actions, and scheduled jobs in one deployment. | React 18, Convex, shadcn/ui, Tailwind, @stacks/connect |
| `stacktreon-contract/` | Clarity smart contract that enforces 30-day subscriptions on Stacks and exposes read-only helpers. | Clarinet, Vitest, @stacks/transactions |

## Status & Roadmap
Stacktreon is a working MVP on Stacks **testnet**.

What works today:
- Creator registration, content upload, and paywalled viewing end to end.
- x402 pay-per-view enforced server-side: premium file URLs are only released after the facilitator settles the STX payment.
- **On-chain verification of subscription payments:** a reported subscribe() transaction only mints a subscription after the backend confirms it on the Stacks chain (correct contract, function, sender, and creator), with automatic retries while the transaction confirms.
- On-chain 30-day subscriptions with creator withdrawals, covered by the Clarinet test suite; backend logic covered by a convex-test suite.

Known limitations, planned as the next milestone (mainnet hardening):
- Mutations identify users by wallet address without a signature challenge; wallet-signature auth is planned.
- Content file URLs from Convex storage are long-lived once unlocked (no expiry).
- The contract's `register-creator` accepts an arbitrary principal; the hardened version will key registration to the caller.

## End-to-End Capabilities
- **Wallet-aware UX:** `WalletProvider` keeps browser state in sync with Stacks Connect so the front-end knows when to surface CTAs, run contract calls, or unlock files.
- **Creator & fan consoles:** Routes cover `/explore`, `/creator/:handle`, `/content/:id`, `/dashboard/creator`, `/dashboard/fan`, plus onboarding/upload flows. Data is reactive: dashboards and subscription status update live as Convex data changes.
- **Content security:** Files live in Convex file storage; premium items return no file URL unless the viewer holds an active subscription or completes a one-off x402 payment.
- **Subscriptions + PPV accounting:** Every transaction is recorded; subscription rows are created only after on-chain verification, and pay-per-view unlocks are recorded when the x402 facilitator settles the payment.
- **On-chain guardrails:** `stacktreon-contract` defines registration, subscription, withdrawal, and fee updates with STX transfers and expiry logic baked in.

## Prerequisites
- Node.js 18.18+ (or 20+) and npm 9+.
- A Convex account (free) for cloud deployments; local development works without one.
- Clarinet CLI (`npm install -g @hirosystems/clarinet`) for contract builds/tests.
- A Stacks wallet (Leather/Xverse) configured for testnet transactions.

## Getting Started
1. **Install dependencies**
   ```bash
   npm install --prefix content-creator-hub
   npm install --prefix stacktreon-contract
   ```
2. **Start the backend and front-end**
   ```bash
   cd content-creator-hub

   # terminal 1 - Convex backend (creates a local dev deployment on first run)
   npx convex dev

   # terminal 2 - front-end
   npm run dev
   ```
3. Optional: seed demo data with `npx convex run seed:demo`.
4. Visit `http://localhost:8080` (Vite dev port).

## Package Notes
### `content-creator-hub`
- **Routing & providers:** `src/App.tsx` wires the theme, Convex client, wallet context, toasters, and React Router paths.
- **Convex backend (`convex/`):**
  - `schema.ts` defines creators, contents, subscriptions, and transactions with the indexes the queries use.
  - `creators.ts`, `content.ts`, `subscriptions.ts`, `transactions.ts` hold the queries/mutations the pages call through generated types.
  - `http.ts` implements the x402 v2 pay-per-view protocol as an HTTP action on the deployment's `.convex.site` domain (402 challenge, facilitator settle, payment recording).
  - `verify.ts` verifies subscription transactions against the Hiro API before minting access; `crons.ts` expires stale subscriptions hourly.
- **x402 client:** `src/lib/x402Client.ts` handles the 402 challenge, opens the STX transfer, waits for confirmation, and retries with the payment signature.
- **Commands:** `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm run test` (app + convex-test suites), `npx convex dev`.

### `stacktreon-contract`
- **Contract (`contracts/stacktreonv1.clar`):**
  - `register-creator` sets an initial fee and zeroes earnings.
  - `subscribe` transfers STX, records totals/balances, and stamps a 30-day expiry.
  - `withdraw-creator-earning` lets creators pull down accumulated microSTX.
  - `update-subscription-fee` and `is-active-subscriber` cover pricing changes and read-only validation.
- **Testing:** Run `npm test` (Vitest + Clarinet harness) or `npm run test:watch` to rerun on file changes.

## Environment
| Service | Variable | Purpose | Default |
| --- | --- | --- | --- |
| Front-end | `VITE_CONVEX_URL` | Convex deployment URL (set automatically by `npx convex dev`; set in Vercel for production). | - |
| Front-end | `VITE_CONVEX_SITE_URL` | Override for the x402 HTTP action origin. Cloud deployments derive it from `VITE_CONVEX_URL` (`.convex.cloud` -> `.convex.site`). | derived |
| Front-end | `VITE_NETWORK` | `mainnet` or `testnet` for wallet + x402 clients. | `testnet` |
| Front-end | `VITE_CONTRACT_ADDRESS` / `VITE_CONTRACT_NAME` | Clarity contract coordinates for `useSubscriptionContract`. | `ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E` / `stacktreonv1` |
| Convex | `NETWORK` | Stacks network for x402 + transaction verification. | `testnet` |
| Convex | `FACILITATOR_URL` | x402 facilitator that settles STX payments. | `https://facilitator.stacksx402.com` |
| Convex | `CONTRACT_ID` | Contract checked during subscription verification. | `ST1A514...stacktreonv1` |

Set Convex variables with `npx convex env set NAME value` (per deployment).

## Testing & Quality Gates
- **Front-end + backend:** `npm run test` runs the app suite (jsdom) and the Convex function suite (convex-test); `npm run lint` for static checks.
- **Contracts:** `npm test` compiles + runs Clarinet simulations; add more cases under `tests/` to capture new contract paths.

## Deployment Checklist
1. `npx convex deploy` from `content-creator-hub/` to push functions to the production Convex deployment, then set its env vars (`npx convex env set NETWORK testnet` etc. with `--prod`).
2. Set `VITE_CONVEX_URL` (and optionally `VITE_CONVEX_SITE_URL`) in Vercel to the production deployment URLs and redeploy the front-end.
3. Deploy the Clarity contract and update `VITE_CONTRACT_*` plus the Convex `CONTRACT_ID` when moving networks.
4. Keep wallet mnemonics in untracked settings files only; rotate them if they are ever exposed.

## Contributing
- Branch off `main`, keep commits scoped, and include tests for behavior changes.
- Document new Convex functions or contract exports in this README (and module-level READMEs if needed).
- Open a PR that runs `npm run lint && npm run test` in every affected package before requesting review.

# Stacktreon Content Creator Hub

A Vite + React + TypeScript front-end with a [Convex](https://convex.dev) backend for Stacktreon creators and fans. It blends subscription memberships with pay-per-view unlocks on the Stacks blockchain: the `convex/` directory holds the database schema, queries/mutations, file storage flows, the x402 HTTP action, and on-chain transaction verification, all deployed together.

## Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Architecture & Data Flow](#architecture--data-flow)
- [Payments & Wallet Integrations](#payments--wallet-integrations)
- [Testing & Quality](#testing--quality)
- [Contributing](#contributing)
- [License](#license)

## Features
- **Full product surface**: Landing page (`/`), creator directory (`/explore`), profiles (`/creator/:handle`), content viewing (`/content/:id`), and creator/fan dashboards with onboarding and upload flows.
- **Reactive data**: Pages subscribe to Convex queries, so dashboards, feeds, and subscription status update live without refetch logic.
- **Wallet-aware UX**: Global `WalletProvider` stores Stacks Connect session state so navigation, dashboards, and unlock actions stay in sync.
- **Hybrid revenue model**: Creator profiles run on-chain subscription flows via `useSubscriptionContract`; individual content unlocks through x402 micropayments.
- **Verified subscriptions**: A reported subscribe() transaction only grants access after the backend confirms it on the Stacks chain via the Hiro API.

## Tech Stack
- [Vite 5](https://vitejs.dev/) with SWC React plugin for fast dev + builds
- React 18 + TypeScript + React Router DOM for SPA routing
- [Convex](https://convex.dev) for the database, file storage, HTTP actions, crons, and generated end-to-end types
- Tailwind CSS, tailwind-merge, tailwindcss-animate, and shadcn/ui primitives
- Stacks ecosystem libraries: `@stacks/connect`, `@stacks/transactions`, `x402-stacks`, `@stacks/network`
- Testing: Vitest + Testing Library (app) and convex-test (backend functions)

## Project Structure
```
content-creator-hub/
├─ convex/                 # Backend: schema, functions, x402 HTTP action, crons
│  ├─ schema.ts            # creators / contents / subscriptions / transactions
│  ├─ creators.ts          # register + lookups
│  ├─ content.ts           # upload, lock/unlock logic, feed
│  ├─ subscriptions.ts     # status, listings, expiry cron target
│  ├─ transactions.ts      # submitSubscription, listings, earnings
│  ├─ verify.ts            # on-chain verification via Hiro API
│  ├─ http.ts              # x402 pay-per-view HTTP action (.convex.site)
│  ├─ crons.ts             # hourly subscription expiry
│  └─ stacktreon.test.ts   # convex-test suite
├─ src/
│  ├─ components/          # Layout, navigation, shadcn/ui wrappers, ThemeProvider
│  ├─ contexts/            # WalletProvider with connect/disconnect helpers
│  ├─ hooks/               # Contract + toast hooks (`useSubscriptionContract`, etc.)
│  ├─ lib/                 # x402 client, shared types, utilities
│  ├─ pages/               # Route-level UI (Index, Explore, CreatorDashboard, etc.)
│  ├─ App.tsx              # Route registry + providers (ConvexProvider, WalletProvider)
│  └─ main.tsx             # React root mount
├─ public/                 # Static assets, robots.txt, favicon
└─ vite.config.ts          # Vite + plugin-react-swc setup
```

The sister package `stacktreon-contract` (Clarity contract) lives at the repo root.

## Getting Started
### Prerequisites
- Node.js 18.18+ (or 20+) and npm 9+
- A Stacks-compatible wallet (Leather, Xverse) for local testing

### Install and run
```bash
cd content-creator-hub
npm install

# terminal 1 - Convex backend (creates a local dev deployment on first run)
npx convex dev

# terminal 2 - front-end with hot reload
npm run dev
```
Optional: seed demo data with `npx convex run seed:demo`.

### Build for production
```bash
npm run build
npm run preview   # serve the dist folder locally
```

## Environment Variables
`npx convex dev` writes `VITE_CONVEX_URL` (and locally `VITE_CONVEX_SITE_URL`) to `.env.local`.

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Convex deployment URL used by the React client. | set by `npx convex dev`
| `VITE_CONVEX_SITE_URL` | Origin for the x402 HTTP action. Cloud deployments derive it from `VITE_CONVEX_URL`. | derived
| `VITE_NETWORK` | Stacks network identifier used by Stacks Connect + x402 signing. | `testnet`
| `VITE_CONTRACT_ADDRESS` | Clarity contract address for subscription logic. | `ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E`
| `VITE_CONTRACT_NAME` | Contract name deployed at the address above. | `stacktreonv1`

Convex deployment variables (`NETWORK`, `FACILITATOR_URL`, `CONTRACT_ID`) are set with `npx convex env set`.

## Available Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with React Fast Refresh. |
| `npx convex dev` | Run/push the Convex backend and regenerate types on change. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production bundle locally. |
| `npm run lint` | ESLint over the project. |
| `npm run test` | Vitest: app suite (jsdom) + Convex function suite (convex-test). |
| `npm run test:watch` | Watch-mode Vitest for TDD. |

## Architecture & Data Flow
- **Routing & providers**: `src/App.tsx` wires React Router paths and wraps them with `ThemeProvider`, `ConvexProvider`, `WalletProvider`, and tooltip/toast systems.
- **Data**: Pages call Convex hooks (`useQuery`, `useMutation`) against the functions in `convex/`, with types generated from the schema. Loading states come from `useQuery` returning `undefined`; results stream in live.
- **Content locking**: `convex/content.ts` returns a file URL only when the content is free or the viewer holds an active subscription; otherwise `fileUrl: null, locked: true`.
- **Subscriptions**: `transactions.submitSubscription` stores a pending transaction and schedules `verify.verifySubscriptionTx`, which polls the Hiro API until the subscribe() call confirms, then mints the 30-day subscription. The profile page updates reactively when verification lands.
- **Files**: Uploads go through `content.generateUploadUrl` to Convex file storage; the stored id is resolved to a serving URL at query time for authorized viewers.

## Payments & Wallet Integrations
- `@stacks/connect` powers both wallet connects (`WalletContext`) and contract interactions (`useSubscriptionContract`).
- x402 micropayments (`src/lib/x402Client.ts`) implement the HTTP 402 flow against the Convex HTTP action (`convex/http.ts`): read the 402 challenge, open an STX transfer with `openSTXTransfer`, poll the Hiro API for the raw transaction, encode the payment signature, and replay the request. The server settles the payment through the x402 facilitator before releasing content and recording the transaction.

## Testing & Quality
- **Backend functions**: `convex/stacktreon.test.ts` covers registration uniqueness, content lock logic, subscription status/expiry, idempotent confirmation, pay-per-view recording, and earnings math via convex-test.
- **Unit/UI tests**: Vitest + Testing Library live in `src/test/`. Add suites near the components they cover (`*.test.tsx`).
- **Linting & types**: `npm run lint`; `tsconfig.app.json` + path alias `@/*`. Shared response types live in `src/lib/types.ts`, derived from the Convex functions so they cannot drift.

## Contributing
1. Fork or branch from `main`.
2. Install deps and create a feature branch.
3. Add/modify tests and run `npm run lint && npm run test` before opening a PR.
4. Document user-visible changes in this README or relevant docs.

## License
MIT, per the repository root [LICENSE](../LICENSE).

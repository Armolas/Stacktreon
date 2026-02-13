# Stacktreon Content Creator Hub

A Vite + React + TypeScript front-end for Stacktreon creators and collectors. It blends subscription memberships with pay-per-view unlocks on the Stacks blockchain, delivering responsive marketing pages, creator tools, and fan dashboards backed by shadcn/ui components and Tailwind CSS.

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
- **Curated surfaces**: Landing page (`/`) highlights Stacktreon positioning, while `/explore`, `/creator/:handle`, `/content/:id`, `/dashboard/creator`, `/dashboard/fan`, `/dashboard/creator/register`, `/dashboard/creator/upload`, and `/dashboard/creator` provide end-to-end flows.
- **Wallet-aware UX**: Global `WalletProvider` stores Stacks Connect session state so navigation, dashboards, and unlock actions stay in sync.
- **Hybrid revenue model**: Creator profiles run on-chain subscription flows via `useSubscriptionContract`, and individual content relies on x402 micropayments for instant pay-per-view unlocks.
- **Operational dashboards**: Creator views aggregate TanStack Query results (content, subscriptions, transactions) into KPIs and tables; fans get membership history, an aggregated feed, and transaction timelines.
- **UI system**: Tailwind CSS + shadcn/ui + lucide icons power a11y-friendly components with dark/light theming via `ThemeProvider` and `next-themes`.
- **Typed API layer**: `src/lib/api.ts` centralizes REST calls, response types, and helpers, keeping pages lean and type-safe.

## Tech Stack
- [Vite 5](https://vitejs.dev/) with SWC React plugin for fast dev + builds
- React 18 + TypeScript + React Router DOM for SPA routing
- @tanstack/react-query for caching and background refetching
- Tailwind CSS, tailwind-merge, tailwindcss-animate, and shadcn/ui primitives
- Stacks ecosystem libraries: `@stacks/connect`, `@stacks/transactions`, `x402-stacks`, `@stacks/network`
- Form helpers: `react-hook-form`, `@hookform/resolvers`, `zod`
- Testing: Vitest + @testing-library/react + jsdom

## Project Structure
```
content-creator-hub/
├─ src/
│  ├─ components/         # Layout, navigation, shadcn/ui wrappers, ThemeProvider
│  ├─ contexts/           # WalletProvider with connect/disconnect helpers
│  ├─ hooks/              # Contract + toast hooks (`useSubscriptionContract`, etc.)
│  ├─ lib/                # REST + x402 clients, utilities
│  ├─ pages/              # Route-level UI (Index, Explore, CreatorDashboard, etc.)
│  ├─ test/               # Vitest setup + sample specs
│  ├─ App.tsx             # Route registry + providers
│  └─ main.tsx            # React root + StrictMode mount
├─ public/                # Static assets, robots.txt, favicon
├─ tailwind.config.ts     # Tailwind theme tokens + shadcn presets
├─ tsconfig*.json         # TS + path aliases (`@/*`)
└─ vite.config.ts         # Vite + plugin-react-swc setup
```

Sister packages (`stacktreon-backend`, `stacktreon-contract`) live at the repo root. Run the backend API alongside this UI for local development.

## Getting Started
### Prerequisites
- Node.js 18.18+ (or 20+) and npm 9+/pnpm 8+/Bun 1.1+
- A Stacks-compatible wallet (Leather, Hiro) for local testing
- (Optional) Running `stacktreon-backend` on `http://localhost:3000`

### Install dependencies
```bash
# from repo root
cd content-creator-hub
npm install   # or pnpm install / bun install
```

### Start the dev server
```bash
npm run dev
```
The app starts on `http://localhost:5173` with hot module reload. Ensure your backend and contract emulator/testnet are reachable.

### Build for production
```bash
npm run build
npm run preview   # serve the dist folder locally
```

## Environment Variables
Create an `.env` or `.env.local` in `content-creator-hub/` (Vite loads `VITE_*`).

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_URL` | Base URL for Stacktreon REST API (`/creators`, `/content`, etc.). Point to `stacktreon-backend`. | `http://localhost:3000`
| `VITE_NETWORK` | Stacks network identifier used by Stacks Connect + x402 signing. | `testnet`
| `VITE_CONTRACT_ADDRESS` | Clarity contract address for subscription logic. | `ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E`
| `VITE_CONTRACT_NAME` | Contract name deployed at the address above. | `stacktreonv1`

Restart `npm run dev` after editing env vars.

## Available Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with React Fast Refresh. |
| `npm run build` | Production build to `dist/` (checks TypeScript + bundles assets). |
| `npm run build:dev` | Build with `--mode development` for staging smoke tests. |
| `npm run preview` | Preview the production bundle locally. |
| `npm run lint` | ESLint over `src/` (configured via `eslint.config.js`). |
| `npm run test` | Run Vitest in CI mode. |
| `npm run test:watch` | Watch-mode Vitest for TDD. |

## Architecture & Data Flow
- **Routing**: `src/App.tsx` wires React Router paths to page components and wraps them with `ThemeProvider`, `QueryClientProvider`, `WalletProvider`, and tooltip/toast systems.
- **Data fetching**: `src/lib/api.ts` exposes typed helpers (creators, content, subscriptions, transactions). Pages call them inside hooks, while TanStack Query manages caching, loading states, and refetches.
- **State management**: Contexts (`WalletContext`) hold authenticated wallet data (STX + BTC addresses) and expose `connectWallet`/`disconnectWallet` actions. Hooks such as `useSubscriptionContract` encapsulate Clarity contract calls and readonly queries.
- **UI patterns**: The app uses shadcn/ui primitives (Accordion, Tabs, DropdownMenu, Toast, etc.) composed inside `Layout`, `Navbar`, and page-level components. Tailwind handles layout tokens; `App.css` + `index.css` add global flourishes.
- **Pages at a glance**:
  - `/`: Marketing hero + stats + feature cards.
  - `/explore`: Category chips, full-text search, and creator cards sourced from `/creators` API.
  - `/creator/:handle`: Profile layout with subscription CTA, gated content list, and contract-backed subscribe flow.
  - `/content/:id`: Handles x402 402 responses, opens wallet for payment, retries fetch with payment signature, and renders media viewers (video/audio/pdf/iframe).
  - `/dashboard/creator` (+ `/register`, `/upload`): Creator onboarding, content uploader, metrics, subscriber lists, and transaction logs.
  - `/dashboard/fan`: Fan console showing subscriptions, recent transactions, and aggregated release feed.
  - `*`: Polished 404 page.

## Payments & Wallet Integrations
- `@stacks/connect` powers both simple wallet connects (`WalletContext`) and contract interactions (`useSubscriptionContract`). Users approve transactions inside their wallet; callbacks update local state and REST records.
- x402 micropayments (`src/lib/x402Client.ts`) implement the HTTP 402 spec. The client retries guarded endpoints (`/content/x402/:id`), interprets `WWW-Authenticate` headers, opens an STX transfer with `openSTXTransfer`, polls the Hiro API for raw transactions, encodes a payment signature, and replays the request to obtain unlocked content.
- REST transactions recorded through `createTransaction` / `updateTransactionStatus` keep off-chain analytics aligned with on-chain state.

## Testing & Quality
- **Unit/UI tests**: Vitest + Testing Library live in `src/test/`. Add suites near the components they cover (`*.test.tsx`) and import `src/test/setup.ts` for DOM shims.
- **Linting**: `npm run lint` enforces modern ESLint + TypeScript rules plus React Refresh + Hooks best practices.
- **Type safety**: `tsconfig.app.json` + path alias `@/*` keep imports tidy. Favor the shared types in `src/lib/api.ts` when extending endpoints to avoid drift.

## Contributing
1. Fork or branch from `main`.
2. Install deps and create a feature branch.
3. Add/modify tests and run `npm run lint && npm run test` before opening a PR.
4. Document user-visible changes in this README or relevant docs.

## License
No license has been declared yet. Choose and add one (MIT, Apache-2.0, etc.) before publishing the repository publicly.

# ✦ Stellar Testnet Faucet dApp

> A production-quality Soroban smart contract faucet on Stellar Testnet — with wallet integration, rate limiting, request tracking, caching, analytics, and a cosmic UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar%20Testnet-7c3aed)](https://stellar.org)
[![Smart Contract](https://img.shields.io/badge/Contract-Soroban-3461f5)](https://soroban.stellar.org)

https://stellar-faucatt.vercel.app/

---

## 🌌 Project Overview

This dApp lets users request free testnet XLM via a **Soroban smart contract**, with:

- **Freighter wallet** integration (connect, sign, disconnect, auto-reconnect)
- **On-chain rate limiting** — 60 seconds between requests per wallet
- **Per-wallet + global request counters** tracked in contract storage
- **Real-time transaction status** (signing → submitting → confirming → success)
- **React Query caching** for all contract state
- **Cooldown timer** (live countdown with progress bar)
- **Analytics panel** (hourly chart, XLM dispensed, success rate)
- **Copy-to-clipboard** for transaction hashes + explorer links
- **Dark-mode cosmic UI** with animated star field, glass cards, and gradient text

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Rust + Soroban SDK 20 |
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, custom CSS animations |
| State/Cache | React Query (TanStack Query v5) |
| Animation | Framer Motion |
| Wallet | Freighter API (`@stellar/freighter-api`) |
| Blockchain SDK | `@stellar/stellar-sdk` v11 |
| Frontend Tests | Vitest + React Testing Library |
| Contract Tests | Rust `#[test]` with `soroban-sdk/testutils` |
| Deployment | Stellar Testnet + Vercel |

---

## 📁 Project Structure

```
stellar-faucet-dapp/
├── contracts/
│   └── faucet/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Smart contract implementation
│           └── test.rs         # 8 Rust tests
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout + metadata
│   │   │   ├── page.tsx        # Main page
│   │   │   └── globals.css     # Design system CSS
│   │   ├── components/
│   │   │   ├── FaucetApp.tsx   # Main orchestrator
│   │   │   ├── FaucetCard.tsx  # Request card + animated button
│   │   │   ├── WalletButton.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   ├── RequestHistory.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StarField.tsx   # Canvas star animation
│   │   │   └── Providers.tsx   # React Query + Toaster
│   │   ├── hooks/
│   │   │   ├── useWallet.ts    # Freighter integration
│   │   │   └── useFaucet.ts    # React Query hooks + mutation
│   │   ├── lib/
│   │   │   └── stellar.ts      # SDK + contract interaction
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── tests/
│   │       ├── setup.ts
│   │       └── faucet.test.tsx # Frontend tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── vitest.config.ts
│   └── vercel.json
├── scripts/
│   └── deploy.sh               # One-shot deploy script
├── Cargo.toml                  # Workspace
└── README.md
```

---

## 🔐 Smart Contract

### Core Functions

| Function | Description |
|----------|-------------|
| `initialize(admin, amount?, cooldown?)` | Set up faucet with admin, drip amount (default 10 XLM), cooldown (default 60s) |
| `request_funds(user, token_id)` | Request XLM — checks cooldown, balance, transfers, emits events |
| `get_last_request(user)` | Returns last request timestamp (Unix seconds) |
| `get_request_count(user)` | Returns per-wallet request count |
| `get_global_count()` | Returns total faucet requests across all users |
| `get_cooldown_remaining(user)` | Seconds until user can request again |
| `get_faucet_amount()` | Current drip amount in stroops |
| `set_faucet_amount(admin, amount)` | Admin: update drip amount |
| `set_cooldown(admin, seconds)` | Admin: update cooldown duration |

### Storage Model

```rust
DataKey::LastRequest(Address)   → Persistent, per-wallet timestamp
DataKey::RequestCount(Address)  → Persistent, per-wallet counter
DataKey::GlobalCount            → Instance, total requests
DataKey::Admin                  → Instance, admin address
DataKey::FaucetAmount           → Instance, drip per request
DataKey::CooldownSeconds        → Instance, rate limit window
DataKey::Initialized            → Instance, init guard
```

### Events Emitted

```
("faucet", "init")       → (admin, amount, cooldown)
("faucet", "requested")  → user_address
("faucet", "sent")       → (user, amount, new_count)
("faucet", "rejected")   → (user, seconds_remaining)
("faucet", "empty")      → contract_balance
```

### Contract Logic Flow

```
request_funds(user, token_id)
  ├─ user.require_auth()              ← Wallet must sign
  ├─ Check last_request + cooldown    ← Rate limit
  │   └─ if too soon → emit "rejected" + panic
  ├─ Check contract token balance     ← Sufficient funds?
  │   └─ if insufficient → emit "empty" + panic
  ├─ emit "requested"
  ├─ token::transfer(contract → user, amount)
  ├─ update LastRequest(user) = now
  ├─ update RequestCount(user) += 1
  ├─ update GlobalCount += 1
  └─ emit "sent" → return amount
```

---

## 🧪 Testing

### Smart Contract Tests (Rust)

Located in `contracts/faucet/src/test.rs`. 8 tests covering:

1. **test_request_funds_success** — User receives correct XLM amount
2. **test_rate_limit_blocks_second_request** — Immediate second request panics
3. **test_request_counter_increments** — Per-wallet and global counters update
4. **test_rate_limit_clears_after_cooldown** — Second request succeeds after 61s
5. **test_cooldown_remaining** — Returns accurate remaining seconds
6. **test_multiple_users_independent** — Different wallets tracked separately
7. **test_admin_set_faucet_amount** — Admin can update drip amount
8. **test_reject_when_balance_insufficient** — Panics if faucet is empty

```bash
# Run contract tests
cd stellar-faucet-dapp
cargo test -p faucet -- --nocapture
```

### Frontend Tests (Vitest + RTL)

Located in `frontend/src/tests/faucet.test.tsx`. 15+ tests covering:

- **WalletButton**: renders, calls connect(), shows address, handles loading/disconnect
- **FaucetCard**: renders button, triggers onRequest, all loading states (signing/submitting/pending/success), cooldown display, tx hash display
- **RequestHistory**: empty state, renders items, count badge
- **Stellar utils**: stroopsToXlm, xlmToStroops, round-trip accuracy

```bash
cd frontend
npm install
npm test          # run once
npm run test:watch  # watch mode
```

---

## 🚀 Deployment

### Prerequisites

```bash
# Install Rust + WASM target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli

# Install Node.js 18+
# https://nodejs.org
```

### 1. Deploy Smart Contract

```bash
# One-shot deployment (generates key, funds via Friendbot, deploys, initializes)
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script:
1. Generates a Stellar testnet keypair (saved to `.stellar_deploy_key`)
2. Funds it via Friendbot
3. Compiles the WASM contract
4. Uploads WASM to testnet
5. Deploys contract instance
6. Initializes with 10 XLM drip + 60s cooldown
7. Funds faucet contract via Friendbot
8. Writes `frontend/.env.local` with the contract ID

### 2. Manual Deploy (step by step)

```bash
# Generate keypair
soroban keys generate deployer-key --network testnet

# Get public key
soroban keys address deployer-key

# Fund via Friendbot
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"

# Build
cargo build --target wasm32-unknown-unknown --release -p faucet

# Upload WASM
soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/faucet.wasm \
  --source deployer-key \
  --network testnet

# Deploy
soroban contract deploy \
  --wasm-hash <WASM_HASH> \
  --source deployer-key \
  --network testnet

# Initialize
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer-key \
  --network testnet \
  -- initialize \
  --admin <DEPLOYER_PUBLIC_KEY> \
  --faucet_amount 100000000 \
  --cooldown_seconds 60
```

### 3. Deploy Frontend to Vercel

```bash
cd frontend
npm install

# Set env vars in Vercel dashboard (or vercel.json):
# NEXT_PUBLIC_FAUCET_CONTRACT_ID=<your_contract_id>
# (other vars are already set in vercel.json)

npx vercel --prod
```

Or connect your GitHub repo to Vercel and set environment variables in the dashboard.

---

## 🛠️ Local Development

```bash
# Terminal 1: Start Next.js dev server
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your contract ID
npm run dev

# Open http://localhost:3000
# Connect Freighter wallet in Testnet mode
```

### Configure Freighter for Testnet

1. Install [Freighter](https://freighter.app) browser extension
2. Open Freighter → Settings → Network → Select **Testnet**
3. Create or import a testnet wallet
4. Get testnet XLM: https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY

---
screenshots/
<img width="1915" height="962" alt="Request XLM" src="https://github.com/user-attachments/assets/31311011-9b93-4446-ae1c-cea5eef0f41c" />
<img width="1917" height="971" alt="Homepage with wallet" src="https://github.com/user-attachments/assets/fee3f335-8ea5-4f03-8674-51a8fd845f5e" />
<img width="1919" height="1078" alt="Tanstack details" src="https://github.com/user-attachments/assets/5d386789-03e6-419e-9364-d36092458c95" />
<img width="1919" height="962" alt="Stats" src="https://github.com/user-attachments/assets/d834570b-1ad2-49a6-a336-aaa927b2c80f" />

----
demo/


https://github.com/user-attachments/assets/49883152-0f63-4d87-9a95-d89986ed232f



## 📊 Features

- **Faucet Request** — 10 XLM per request, rate limited to once per 60 seconds
- **Wallet Auto-reconnect** — Persists connection via localStorage
- **Real-time Cooldown Timer** — Live countdown with animated progress bar
- **Transaction Status** — 4-state pipeline (signing → submitting → confirming → success)
- **Request History** — Persistent local history with copy + explorer links
- **Analytics Panel** — Hourly bar chart, total XLM, success rate, global count
- **Stats Panel** — Per-wallet request count, last request time, faucet balance
- **Copy TX Hash** — One-click copy with visual feedback
- **Explorer Links** — Direct links to stellar.expert for every transaction

---

## 🔒 Security Notes

- Contract uses `require_auth()` — only the wallet owner can request for their address
- Rate limiting is enforced entirely on-chain in the smart contract
- Admin functions verify admin address against stored admin
- Contract panics on insufficient balance (prevents partial states)
- Frontend `.env.local` is git-ignored (never commit private keys)

---

## 📄 License

MIT © 2024

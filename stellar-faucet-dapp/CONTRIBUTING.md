# Contributing to Stellar Faucet dApp

Thank you for your interest in contributing! This document explains how to set up the project, run tests, and submit changes.

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust + Cargo | stable | https://rustup.rs |
| WASM target | — | `rustup target add wasm32-unknown-unknown` |
| Soroban CLI | latest | `cargo install --locked soroban-cli` |
| Node.js | ≥ 18 | https://nodejs.org |
| Freighter | latest | https://freighter.app |

### Clone & install

```bash
git clone https://github.com/YOUR_ORG/stellar-faucet-dapp.git
cd stellar-faucet-dapp
cd frontend && npm install && cd ..
```

---

## Running Locally

```bash
# Start the frontend (port 3000)
make dev

# Or manually:
cd frontend && npm run dev
```

Copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_FAUCET_CONTRACT_ID` to your deployed contract.

---

## Running Tests

```bash
# All tests (Rust + frontend)
make test

# Contract tests only (8 tests)
make test-contract

# Frontend tests only (15+ tests)
make test-frontend

# Frontend tests in watch mode
make test-frontend-watch
```

---

## Code Style

### Rust
- Format: `make fmt` (runs `cargo fmt`)
- Lint: `make lint` (runs `cargo clippy -- -D warnings`)
- All public functions must have doc comments
- All new contract functions must have corresponding tests in `test.rs`

### TypeScript / React
- Strict TypeScript — no `any`, no ts-ignore
- Components use named exports
- Hooks live in `src/hooks/`, SDK wrappers in `src/lib/`
- Tests use Testing Library queries (no `querySelector`)

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(contract): add admin withdraw function
fix(frontend): correct cooldown timer on reconnect
test: add missing rate-limit edge case
docs: update deployment instructions
chore: bump soroban-sdk to 20.1.0
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`

---

## Pull Request Checklist

Before opening a PR, ensure:

- [ ] `make test` passes (all 8 contract + 15+ frontend tests)
- [ ] `make lint` passes with no warnings
- [ ] New contract functions have tests in `test.rs`
- [ ] New UI components have tests in `faucet.test.tsx`
- [ ] Types are updated in `src/types/index.ts` if needed
- [ ] README updated if behaviour changes
- [ ] Commits follow conventional commit format

---

## Project Architecture

```
request_funds() call flow:
  WalletButton (connect)
    → useWallet.signTransaction()
      → FaucetCard onRequest
        → useFaucetRequest.requestFunds()
          → stellar.ts requestFaucetFunds()
            → SorobanRpc.simulateTransaction()
            → assembleTransaction()
            → Freighter.signTransaction()
            → SorobanRpc.sendTransaction()
            → poll SorobanRpc.getTransaction()
          → update React Query cache
          → append to localStorage history
```

---

## Reporting Issues

Please include:
- Browser + Freighter version
- Network (testnet/mainnet)
- Console errors
- Steps to reproduce

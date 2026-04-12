#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  git-init.sh — Initialise repo with the 4 required commits
#  Run ONCE from the project root: bash scripts/git-init.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${CYAN}[git]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }

# ── Guard: must be project root
[[ -f "Cargo.toml" && -d "frontend" && -d "contracts" ]] || {
  echo "Run from project root (stellar-faucet-dapp/)"; exit 1; }

# ── Init
log "Initialising git repository…"
git init -b main
git config user.email "dev@stellar-faucet.xyz"
git config user.name  "Stellar Faucet Dev"

# ─────────────────────────────────────────────
# COMMIT 1 — Project setup
# ─────────────────────────────────────────────
log "Commit 1: Project setup"
git add \
  .gitignore \
  README.md \
  Cargo.toml \
  contracts/faucet/Cargo.toml \
  frontend/package.json \
  frontend/tsconfig.json \
  frontend/tailwind.config.js \
  frontend/postcss.config.js \
  frontend/next.config.js \
  frontend/vitest.config.ts \
  frontend/.env.example \
  frontend/vercel.json \
  .github/workflows/ci.yml

git commit -m "feat: project setup

- Workspace Cargo.toml with Soroban faucet crate
- Next.js 14 + TypeScript + Tailwind + React Query frontend
- Vitest + React Testing Library test config
- GitHub Actions CI pipeline (lint, test, build, deploy)
- Vercel deployment config
- Environment template"

ok "Commit 1 done"

# ─────────────────────────────────────────────
# COMMIT 2 — Smart contract implementation
# ─────────────────────────────────────────────
log "Commit 2: Smart contract"
git add \
  contracts/faucet/src/lib.rs \
  contracts/faucet/src/test.rs

git commit -m "feat(contract): Soroban faucet smart contract

Core functions:
- request_funds(user, token_id) with auth + cooldown + balance check
- get_last_request / get_request_count / get_global_count
- get_cooldown_remaining / get_faucet_amount
- Admin: set_faucet_amount, set_cooldown

Storage:
- DataKey::LastRequest(Address)  → Persistent timestamp
- DataKey::RequestCount(Address) → Persistent per-wallet counter
- DataKey::GlobalCount           → Instance total counter

Events:
- (faucet, init) (faucet, requested) (faucet, sent)
- (faucet, rejected) (faucet, empty)

Tests (8):
- test_request_funds_success
- test_rate_limit_blocks_second_request
- test_request_counter_increments
- test_rate_limit_clears_after_cooldown
- test_cooldown_remaining
- test_multiple_users_independent
- test_admin_set_faucet_amount
- test_reject_when_balance_insufficient"

ok "Commit 2 done"

# ─────────────────────────────────────────────
# COMMIT 3 — Frontend + integration
# ─────────────────────────────────────────────
log "Commit 3: Frontend + integration"
git add \
  frontend/src/types/index.ts \
  frontend/src/lib/stellar.ts \
  frontend/src/hooks/useWallet.ts \
  frontend/src/hooks/useFaucet.ts \
  frontend/src/app/globals.css \
  frontend/src/app/layout.tsx \
  frontend/src/app/page.tsx \
  frontend/src/components/Providers.tsx \
  frontend/src/components/Header.tsx \
  frontend/src/components/StarField.tsx \
  frontend/src/components/WalletButton.tsx \
  frontend/src/components/FaucetApp.tsx \
  frontend/src/components/FaucetCard.tsx \
  frontend/src/components/StatsPanel.tsx \
  frontend/src/components/RequestHistory.tsx \
  frontend/src/components/AnalyticsPanel.tsx

git commit -m "feat(frontend): Next.js dApp with wallet integration

Wallet (useWallet.ts):
- Freighter API integration (connect/disconnect/sign)
- Auto-reconnect via localStorage
- Network detection

Stellar SDK (stellar.ts):
- fetchFaucetStats() — parallel RPC reads with React Query
- requestFaucetFunds() — build → simulate → assemble → sign → submit → poll
- Friendbot funding helper
- stroopsToXlm / xlmToStroops utilities

React Query hooks (useFaucet.ts):
- useFaucetStats() — cached, auto-refetch every 5s
- useFaucetRequest() — mutation with 4-stage status pipeline
- useRequestHistory() — localStorage-backed request log
- useCooldownTimer() — live countdown

UI Components:
- FaucetCard: animated request button, status display, cooldown progress bar
- WalletButton: connect/disconnect dropdown, address display, copy
- StatsPanel: per-wallet + global stats with skeleton loading
- RequestHistory: sorted history with copy + explorer links
- AnalyticsPanel: bar chart, totals, success rate
- StarField: canvas star animation with shooting stars
- Cosmic dark UI: Orbitron font, glass cards, gradient text, glow effects"

ok "Commit 3 done"

# ─────────────────────────────────────────────
# COMMIT 4 — Tests + deployment
# ─────────────────────────────────────────────
log "Commit 4: Tests + deployment"
git add \
  frontend/src/tests/setup.ts \
  frontend/src/tests/faucet.test.tsx \
  scripts/deploy.sh \
  scripts/git-init.sh

git commit -m "feat(tests+deploy): frontend tests + one-shot deploy script

Frontend tests (Vitest + RTL — 15+ tests):
WalletButton:
  - renders connect button when disconnected
  - calls connect() on click
  - shows connected address
  - disabled + loading text during connection
  - shows disconnect option in dropdown
  - calls disconnect() from dropdown

FaucetCard:
  - renders request button
  - calls onRequest on click (Test 5)
  - shows SIGN IN FREIGHTER during signing (Test 6 — loading state)
  - shows SUBMITTING / CONFIRMING per status
  - disabled during pending / cooldown
  - SUCCESS text on success
  - shows faucet amount from stats
  - displays tx hash after success

RequestHistory:
  - empty state with planet emoji
  - renders history items with amount
  - count badge

Stellar utils:
  - stroopsToXlm round-trip accuracy
  - xlmToStroops precision

Deploy script (scripts/deploy.sh):
  - Generates/loads Stellar keypair
  - Funds via Friendbot
  - cargo build --target wasm32-unknown-unknown --release
  - soroban contract install (upload WASM)
  - soroban contract deploy
  - soroban contract invoke initialize
  - Writes frontend/.env.local automatically"

ok "Commit 4 done"

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Git history initialised (4 commits)      ${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
git log --oneline
echo ""
echo "Next steps:"
echo "  git remote add origin https://github.com/YOUR_USER/stellar-faucet-dapp.git"
echo "  git push -u origin main"

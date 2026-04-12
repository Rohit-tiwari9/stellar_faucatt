# ─────────────────────────────────────────────────────────────────────────────
#  Stellar Faucet dApp — Makefile
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: help build test test-contract test-frontend deploy dev clean fmt lint

NETWORK     := testnet
RPC_URL     := https://soroban-testnet.stellar.org
PASSPHRASE  := "Test SDF Network ; September 2015"
CONTRACT    := contracts/faucet
FRONTEND    := frontend
WASM        := target/wasm32-unknown-unknown/release/faucet.wasm

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
GREEN := \033[0;32m
NC    := \033[0m

help: ## Show this help
	@echo ""
	@echo "  Stellar Testnet Faucet dApp"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  $(CYAN)%-22s$(NC) %s\n",$$1,$$2}'
	@echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
build: build-contract build-frontend ## Build everything

build-contract: ## Compile Soroban contract to WASM
	@echo "$(CYAN)Building contract...$(NC)"
	cargo build \
	  --manifest-path $(CONTRACT)/Cargo.toml \
	  --target wasm32-unknown-unknown \
	  --release
	@echo "$(GREEN)WASM: $(WASM)$(NC)"

build-frontend: ## Build Next.js frontend
	@echo "$(CYAN)Building frontend...$(NC)"
	cd $(FRONTEND) && npm run build

# ── Test ──────────────────────────────────────────────────────────────────────
test: test-contract test-frontend ## Run all tests

test-contract: ## Run Rust contract tests (8 tests)
	@echo "$(CYAN)Running contract tests...$(NC)"
	cargo test \
	  --manifest-path $(CONTRACT)/Cargo.toml \
	  -- --nocapture --test-threads=1

test-frontend: ## Run Vitest frontend tests (15+ tests)
	@echo "$(CYAN)Running frontend tests...$(NC)"
	cd $(FRONTEND) && npm test

test-frontend-watch: ## Run frontend tests in watch mode
	cd $(FRONTEND) && npm run test:watch

test-frontend-ui: ## Open Vitest UI
	cd $(FRONTEND) && npm run test:ui

# ── Dev ───────────────────────────────────────────────────────────────────────
dev: ## Start Next.js dev server (port 3000)
	cd $(FRONTEND) && npm run dev

install: ## Install frontend dependencies
	cd $(FRONTEND) && npm install

# ── Lint & Format ─────────────────────────────────────────────────────────────
fmt: ## Format Rust code
	cargo fmt --manifest-path $(CONTRACT)/Cargo.toml

lint: ## Clippy + ESLint
	cargo clippy \
	  --manifest-path $(CONTRACT)/Cargo.toml \
	  --target wasm32-unknown-unknown \
	  --no-default-features \
	  -- -D warnings
	cd $(FRONTEND) && npm run lint

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy: ## Deploy contract to Stellar Testnet
	bash scripts/deploy.sh

git-init: ## Initialise git repo with 4 required commits
	bash scripts/git-init.sh

# ── Contract interaction (after deploy) ───────────────────────────────────────
contract-stats: ## Query contract global count
	@echo "$(CYAN)Global request count:$(NC)"
	soroban contract invoke \
	  --id $$NEXT_PUBLIC_FAUCET_CONTRACT_ID \
	  --network $(NETWORK) \
	  -- get_global_count

contract-balance: ## Show faucet contract balance
	@echo "$(CYAN)Faucet balance:$(NC)"
	soroban contract invoke \
	  --id $$NEXT_PUBLIC_FAUCET_CONTRACT_ID \
	  --network $(NETWORK) \
	  -- get_faucet_amount

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Clean build artifacts
	cargo clean
	cd $(FRONTEND) && rm -rf .next out coverage
	@echo "$(GREEN)Cleaned.$(NC)"

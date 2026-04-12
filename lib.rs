
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, token,
    symbol_short,
};

#[cfg(test)]
mod test;

// ─────────────────────────────────────────────
//  Storage Keys
// ─────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    LastRequest(Address),
    RequestCount(Address),
    GlobalCount,
    Admin,
    FaucetAmount,
    CooldownSeconds,
    Initialized,
}

// ─────────────────────────────────────────────
//  Contract
// ─────────────────────────────────────────────
#[contract]
pub struct FaucetContract;

// Rate limit: 60 seconds on testnet
const DEFAULT_COOLDOWN: u64 = 60;
// Default drip: 10 XLM in stroops (1 XLM = 10_000_000 stroops)
const DEFAULT_FAUCET_AMOUNT: i128 = 100_000_000; // 10 XLM

#[contractimpl]
impl FaucetContract {

    // ──────────────────────────────
    //  Initialization
    // ──────────────────────────────
    pub fn initialize(
        env: Env,
        admin: Address,
        faucet_amount: Option<i128>,
        cooldown_seconds: Option<u64>,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }
        admin.require_auth();

        let amount = faucet_amount.unwrap_or(DEFAULT_FAUCET_AMOUNT);
        let cooldown = cooldown_seconds.unwrap_or(DEFAULT_COOLDOWN);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FaucetAmount, &amount);
        env.storage().instance().set(&DataKey::CooldownSeconds, &cooldown);
        env.storage().instance().set(&DataKey::GlobalCount, &0u64);
        env.storage().instance().set(&DataKey::Initialized, &true);

        env.events().publish(
            (symbol_short!("faucet"), symbol_short!("init")),
            (admin, amount, cooldown),
        );
    }

    // ──────────────────────────────
    //  Core: Request Funds
    // ──────────────────────────────
    pub fn request_funds(env: Env, user: Address, token_id: Address) -> i128 {
        user.require_auth();

        // ── 1. Check cooldown ──
        let cooldown: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CooldownSeconds)
            .unwrap_or(DEFAULT_COOLDOWN);

        let now = env.ledger().timestamp();

        if let Some(last_request) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::LastRequest(user.clone()))
        {
            let elapsed = now.saturating_sub(last_request);
            if elapsed < cooldown {
                let remaining = cooldown - elapsed;
                // Emit rejection event
                env.events().publish(
                    (symbol_short!("faucet"), symbol_short!("rejected")),
                    (user.clone(), remaining),
                );
                panic!("rate limited: {} seconds remaining", remaining);
            }
        }

        // ── 2. Check faucet balance ──
        let faucet_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::FaucetAmount)
            .unwrap_or(DEFAULT_FAUCET_AMOUNT);

        let token_client = token::Client::new(&env, &token_id);
        let contract_balance = token_client.balance(&env.current_contract_address());

        if contract_balance < faucet_amount {
            env.events().publish(
                (symbol_short!("faucet"), symbol_short!("empty")),
                contract_balance,
            );
            panic!("faucet insufficient funds: balance={}", contract_balance);
        }

        // ── 3. Emit requested event ──
        env.events().publish(
            (symbol_short!("faucet"), symbol_short!("requested")),
            user.clone(),
        );

        // ── 4. Transfer tokens ──
        token_client.transfer(
            &env.current_contract_address(),
            &user,
            &faucet_amount,
        );

        // ── 5. Update storage ──
        env.storage()
            .persistent()
            .set(&DataKey::LastRequest(user.clone()), &now);

        let prev_count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::RequestCount(user.clone()))
            .unwrap_or(0);
        let new_count = prev_count + 1;
        env.storage()
            .persistent()
            .set(&DataKey::RequestCount(user.clone()), &new_count);

        let global: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GlobalCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::GlobalCount, &(global + 1));

        // ── 6. Emit sent event ──
        env.events().publish(
            (symbol_short!("faucet"), symbol_short!("sent")),
            (user.clone(), faucet_amount, new_count),
        );

        faucet_amount
    }

    // ──────────────────────────────
    //  Read: Last Request Timestamp
    // ──────────────────────────────
    pub fn get_last_request(env: Env, user: Address) -> Option<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::LastRequest(user))
    }

    // ──────────────────────────────
    //  Read: Per-user Request Count
    // ──────────────────────────────
    pub fn get_request_count(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::RequestCount(user))
            .unwrap_or(0)
    }

    // ──────────────────────────────
    //  Read: Global Request Count
    // ──────────────────────────────
    pub fn get_global_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::GlobalCount)
            .unwrap_or(0)
    }

    // ──────────────────────────────
    //  Read: Cooldown Remaining (seconds)
    // ──────────────────────────────
    pub fn get_cooldown_remaining(env: Env, user: Address) -> u64 {
        let cooldown: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CooldownSeconds)
            .unwrap_or(DEFAULT_COOLDOWN);

        let now = env.ledger().timestamp();

        match env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::LastRequest(user))
        {
            Some(last) => {
                let elapsed = now.saturating_sub(last);
                if elapsed >= cooldown {
                    0
                } else {
                    cooldown - elapsed
                }
            }
            None => 0,
        }
    }

    // ──────────────────────────────
    //  Read: Faucet Amount
    // ──────────────────────────────
    pub fn get_faucet_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::FaucetAmount)
            .unwrap_or(DEFAULT_FAUCET_AMOUNT)
    }

    // ──────────────────────────────
    //  Admin: Update faucet amount
    // ──────────────────────────────
    pub fn set_faucet_amount(env: Env, admin: Address, amount: i128) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.storage().instance().set(&DataKey::FaucetAmount, &amount);
    }

    // ──────────────────────────────
    //  Admin: Update cooldown
    // ──────────────────────────────
    pub fn set_cooldown(env: Env, admin: Address, seconds: u64) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.storage()
            .instance()
            .set(&DataKey::CooldownSeconds, &seconds);
    }
}

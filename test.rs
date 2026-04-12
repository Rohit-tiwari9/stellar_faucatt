#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token,
    Env, Address,
};

// ─────────────────────────────────────────────
//  Helper: set up env + mint tokens to faucet
// ─────────────────────────────────────────────
fn setup_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user  = Address::generate(&env);

    // Deploy a test token (SAC-compatible)
    let token_id = env.register_stellar_asset_contract(admin.clone());
    let token_admin = token::StellarAssetClient::new(&env, &token_id);

    // Deploy faucet contract
    let faucet_id = env.register_contract(None, FaucetContract);
    let faucet_client = FaucetContractClient::new(&env, &faucet_id);

    // Initialize faucet (10 XLM, 60 s cooldown)
    faucet_client.initialize(&admin, &Some(100_000_000i128), &Some(60u64));

    // Mint 1000 XLM into faucet contract
    token_admin.mint(&faucet_id, &10_000_000_000i128);

    (env, faucet_id, token_id, admin, user)
}

// ─────────────────────────────────────────────
//  Test 1: User can request funds successfully
// ─────────────────────────────────────────────
#[test]
fn test_request_funds_success() {
    let (env, faucet_id, token_id, _admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);
    let token_client = token::Client::new(&env, &token_id);

    let balance_before = token_client.balance(&user);
    assert_eq!(balance_before, 0);

    let amount = client.request_funds(&user, &token_id);
    assert_eq!(amount, 100_000_000i128);

    let balance_after = token_client.balance(&user);
    assert_eq!(balance_after, 100_000_000i128);
}

// ─────────────────────────────────────────────
//  Test 2: Rate limit prevents spam
// ─────────────────────────────────────────────
#[test]
#[should_panic(expected = "rate limited")]
fn test_rate_limit_blocks_second_request() {
    let (env, faucet_id, token_id, _admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);

    // First request — should succeed
    client.request_funds(&user, &token_id);

    // Immediate second request — must panic with "rate limited"
    client.request_funds(&user, &token_id);
}

// ─────────────────────────────────────────────
//  Test 3: Request counter increments correctly
// ─────────────────────────────────────────────
#[test]
fn test_request_counter_increments() {
    let (env, faucet_id, token_id, _admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);

    assert_eq!(client.get_request_count(&user), 0);
    assert_eq!(client.get_global_count(), 0);

    // First request
    client.request_funds(&user, &token_id);
    assert_eq!(client.get_request_count(&user), 1);
    assert_eq!(client.get_global_count(), 1);

    // Advance ledger time past cooldown
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 61,
        ..env.ledger().get()
    });

    // Second request after cooldown
    client.request_funds(&user, &token_id);
    assert_eq!(client.get_request_count(&user), 2);
    assert_eq!(client.get_global_count(), 2);
}

// ─────────────────────────────────────────────
//  Test 4: Rate limit allows after cooldown
// ─────────────────────────────────────────────
#[test]
fn test_rate_limit_clears_after_cooldown() {
    let (env, faucet_id, token_id, _admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);

    client.request_funds(&user, &token_id);

    // Advance 61 seconds
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 61,
        ..env.ledger().get()
    });

    // Should succeed now
    let amount = client.request_funds(&user, &token_id);
    assert_eq!(amount, 100_000_000i128);
}

// ─────────────────────────────────────────────
//  Test 5: get_cooldown_remaining returns correct values
// ─────────────────────────────────────────────
#[test]
fn test_cooldown_remaining() {
    let (env, faucet_id, token_id, _admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);

    // Before any request — no cooldown
    assert_eq!(client.get_cooldown_remaining(&user), 0);

    client.request_funds(&user, &token_id);

    // Advance 10 seconds
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 10,
        ..env.ledger().get()
    });

    let remaining = client.get_cooldown_remaining(&user);
    assert!(remaining > 0 && remaining <= 50, "expected ~50s remaining, got {}", remaining);
}

// ─────────────────────────────────────────────
//  Test 6: Multiple users are tracked independently
// ─────────────────────────────────────────────
#[test]
fn test_multiple_users_independent() {
    let (env, faucet_id, token_id, _admin, user1) = setup_env();
    let user2 = Address::generate(&env);
    let client = FaucetContractClient::new(&env, &faucet_id);

    client.request_funds(&user1, &token_id);
    client.request_funds(&user2, &token_id);

    assert_eq!(client.get_request_count(&user1), 1);
    assert_eq!(client.get_request_count(&user2), 1);
    assert_eq!(client.get_global_count(), 2);
}

// ─────────────────────────────────────────────
//  Test 7: Admin can update faucet amount
// ─────────────────────────────────────────────
#[test]
fn test_admin_set_faucet_amount() {
    let (env, faucet_id, token_id, admin, user) = setup_env();
    let client = FaucetContractClient::new(&env, &faucet_id);

    client.set_faucet_amount(&admin, &200_000_000i128);
    assert_eq!(client.get_faucet_amount(), 200_000_000i128);

    let token_client = token::Client::new(&env, &token_id);
    client.request_funds(&user, &token_id);
    assert_eq!(token_client.balance(&user), 200_000_000i128);
}

// ─────────────────────────────────────────────
//  Test 8: Panics if faucet is underfunded
// ─────────────────────────────────────────────
#[test]
#[should_panic(expected = "faucet insufficient funds")]
fn test_reject_when_balance_insufficient() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user  = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract(admin.clone());
    let faucet_id = env.register_contract(None, FaucetContract);
    let client = FaucetContractClient::new(&env, &faucet_id);

    // Initialize with NO funds minted to faucet
    client.initialize(&admin, &Some(100_000_000i128), &Some(60u64));

    // Should panic: insufficient funds
    client.request_funds(&user, &token_id);
}

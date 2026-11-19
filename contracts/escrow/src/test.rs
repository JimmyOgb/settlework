#![cfg(test)]
extern crate std;

use crate::{
    types::{CreateMilestoneInput, EscrowError, MilestoneStatus},
    EscrowContract, EscrowContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env, String, Vec,
};

struct TestSetup<'a> {
    env: Env,
    client: Address,
    freelancer: Address,
    arbiter: Address,
    escrow_client: EscrowContractClient<'a>,
    token_client: token::Client<'a>,
}

impl<'a> TestSetup<'a> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);

        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);
        let arbiter = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_contract = env.register_stellar_asset_contract_v2(token_admin);
        let token_client = token::Client::new(&env, &token_contract.address());
        let token_sac_client = token::StellarAssetClient::new(&env, &token_contract.address());

        // Mint 10,000 USDC to client
        token_sac_client.mint(&client, &10_000_000_000i128);

        let contract_id = env.register(EscrowContract, ());
        let escrow_client = EscrowContractClient::new(&env, &contract_id);

        Self {
            env,
            client,
            freelancer,
            arbiter,
            escrow_client,
            token_client,
        }
    }

    fn sample_milestones(&self) -> Vec<CreateMilestoneInput> {
        let m1 = CreateMilestoneInput {
            title: String::from_str(&self.env, "Milestone 1: Smart Contract"),
            amount: 2_000_000_000i128, // 2,000 USDC
            deadline: 2_000,
        };
        let m2 = CreateMilestoneInput {
            title: String::from_str(&self.env, "Milestone 2: Frontend & Off-Ramp"),
            amount: 3_000_000_000i128, // 3,000 USDC
            deadline: 5_000,
        };
        vec![&self.env, m1, m2]
    }
}

#[test]
fn test_create_vault_success() {
    let setup = TestSetup::new();
    let milestones = setup.sample_milestones();

    let client_initial_bal = setup.token_client.balance(&setup.client);
    assert_eq!(client_initial_bal, 10_000_000_000);

    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &milestones,
    );
    assert_eq!(vault_id, 1);

    // Verify token deduction from client and transfer into contract
    let client_bal = setup.token_client.balance(&setup.client);
    assert_eq!(client_bal, 5_000_000_000); // 10,000 - 5,000 = 5,000
    let contract_bal = setup.token_client.balance(&setup.escrow_client.address);
    assert_eq!(contract_bal, 5_000_000_000);

    // Verify vault storage
    let vault = setup.escrow_client.get_vault(&vault_id).expect("Vault not found");
    assert_eq!(vault.id, 1);
    assert_eq!(vault.client, setup.client);
    assert_eq!(vault.freelancer, setup.freelancer);
    assert_eq!(vault.arbiter, setup.arbiter);
    assert_eq!(vault.token, setup.token_client.address);
    assert_eq!(vault.total_amount, 5_000_000_000);
    assert_eq!(vault.milestones.len(), 2);
    assert_eq!(vault.created_at, 1_000);

    let m1 = vault.milestones.get(0).unwrap();
    assert_eq!(m1.id, 1);
    assert_eq!(m1.amount, 2_000_000_000);
    assert_eq!(m1.status, MilestoneStatus::Pending);

    // Verify indexes
    let client_vaults = setup.escrow_client.get_client_vaults(&setup.client);
    assert_eq!(client_vaults, vec![&setup.env, 1]);

    let freelancer_vaults = setup.escrow_client.get_freelancer_vaults(&setup.freelancer);
    assert_eq!(freelancer_vaults, vec![&setup.env, 1]);
}

#[test]
fn test_create_vault_validations() {
    let setup = TestSetup::new();

    // 1. Duplicate addresses: client == freelancer
    let res = setup.escrow_client.try_create_vault(
        &setup.client,
        &setup.client,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );
    assert_eq!(res, Err(Ok(EscrowError::InvalidAddresses)));

    // 2. Duplicate addresses: client == arbiter
    let res = setup.escrow_client.try_create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.client,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );
    assert_eq!(res, Err(Ok(EscrowError::InvalidAddresses)));

    // 3. Empty milestones
    let empty_milestones: Vec<CreateMilestoneInput> = Vec::new(&setup.env);
    let res = setup.escrow_client.try_create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &empty_milestones,
    );
    assert_eq!(res, Err(Ok(EscrowError::InvalidMilestoneCount)));

    // 4. Invalid amount (<= 0)
    let bad_amount_milestone = vec![
        &setup.env,
        CreateMilestoneInput {
            title: String::from_str(&setup.env, "Invalid amount"),
            amount: 0,
            deadline: 2_000,
        },
    ];
    let res = setup.escrow_client.try_create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &bad_amount_milestone,
    );
    assert_eq!(res, Err(Ok(EscrowError::InvalidAmount)));

    // 5. Invalid deadline (<= current timestamp)
    let bad_deadline_milestone = vec![
        &setup.env,
        CreateMilestoneInput {
            title: String::from_str(&setup.env, "Invalid deadline"),
            amount: 1_000_000_000,
            deadline: 1_000, // equal to current timestamp 1_000
        },
    ];
    let res = setup.escrow_client.try_create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &bad_deadline_milestone,
    );
    assert_eq!(res, Err(Ok(EscrowError::InvalidDeadline)));
}

#[test]
fn test_submit_and_approve_milestone() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    // 1. Submit empty deliverable fails
    let res = setup.escrow_client.try_submit_milestone(
        &vault_id,
        &1,
        &String::from_str(&setup.env, ""),
    );
    assert_eq!(res, Err(Ok(EscrowError::EmptyDeliverable)));

    // 2. Submit milestone 1 with valid deliverable URL
    let deliverable_url = String::from_str(&setup.env, "https://github.com/stellar/settlework/commit/abc1234");
    setup.escrow_client.submit_milestone(&vault_id, &1, &deliverable_url);

    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    let m1 = vault.milestones.get(0).unwrap();
    assert_eq!(m1.status, MilestoneStatus::Submitted);
    assert_eq!(m1.deliverable, deliverable_url);

    // Freelancer balance before approval
    assert_eq!(setup.token_client.balance(&setup.freelancer), 0);

    // 3. Client approves milestone 1
    setup.escrow_client.approve_milestone(&vault_id, &1);

    // Freelancer receives 2,000 USDC
    assert_eq!(setup.token_client.balance(&setup.freelancer), 2_000_000_000);
    // Contract balance drops from 5,000 to 3,000 USDC
    assert_eq!(
        setup.token_client.balance(&setup.escrow_client.address),
        3_000_000_000
    );

    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    let m1_after = vault.milestones.get(0).unwrap();
    assert_eq!(m1_after.status, MilestoneStatus::Approved);

    // 4. Cannot re-approve an already approved milestone
    let res = setup.escrow_client.try_approve_milestone(&vault_id, &1);
    assert_eq!(res, Err(Ok(EscrowError::InvalidStatus)));
}

#[test]
fn test_early_approval_without_submission() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    // Milestone 1 is Pending. Client approves early
    setup.escrow_client.approve_milestone(&vault_id, &1);

    assert_eq!(setup.token_client.balance(&setup.freelancer), 2_000_000_000);
    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    assert_eq!(
        vault.milestones.get(0).unwrap().status,
        MilestoneStatus::Approved
    );
}

#[test]
fn test_dispute_and_resolution_favor_freelancer() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    // Freelancer submits deliverable
    setup.escrow_client.submit_milestone(
        &vault_id,
        &1,
        &String::from_str(&setup.env, "ipfs://QmHashExample"),
    );

    // Client raises dispute
    setup.escrow_client.raise_dispute(&vault_id, &1, &setup.client);
    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    assert_eq!(
        vault.milestones.get(0).unwrap().status,
        MilestoneStatus::Disputed
    );

    // Cannot approve while disputed
    let res = setup.escrow_client.try_approve_milestone(&vault_id, &1);
    assert_eq!(res, Err(Ok(EscrowError::InvalidStatus)));

    // Arbiter resolves dispute in favor of freelancer
    setup
        .escrow_client
        .resolve_dispute(&vault_id, &1, &true);

    assert_eq!(setup.token_client.balance(&setup.freelancer), 2_000_000_000);
    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    assert_eq!(
        vault.milestones.get(0).unwrap().status,
        MilestoneStatus::Approved
    );
}

#[test]
fn test_dispute_and_resolution_favor_client() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    // Freelancer raises dispute
    setup
        .escrow_client
        .raise_dispute(&vault_id, &1, &setup.freelancer);

    let client_bal_before = setup.token_client.balance(&setup.client);
    assert_eq!(client_bal_before, 5_000_000_000);

    // Arbiter resolves dispute in favor of client (refund)
    setup
        .escrow_client
        .resolve_dispute(&vault_id, &1, &false);

    let client_bal_after = setup.token_client.balance(&setup.client);
    assert_eq!(client_bal_after, 7_000_000_000); // 5,000 + 2,000 refund = 7,000

    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    assert_eq!(
        vault.milestones.get(0).unwrap().status,
        MilestoneStatus::Refunded
    );
}

#[test]
fn test_refund_expired_milestone() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    // Milestone 1 deadline is 2_000. Current time is 1_000.
    // Trying to refund before deadline fails:
    let res = setup.escrow_client.try_refund_expired(&vault_id, &1);
    assert_eq!(res, Err(Ok(EscrowError::DeadlineNotPassed)));

    // Fast-forward ledger time past deadline to 2_500
    setup.env.ledger().set_timestamp(2_500);

    let client_bal_before = setup.token_client.balance(&setup.client);
    assert_eq!(client_bal_before, 5_000_000_000);

    // Refund expired milestone 1
    setup.escrow_client.refund_expired(&vault_id, &1);

    let client_bal_after = setup.token_client.balance(&setup.client);
    assert_eq!(client_bal_after, 7_000_000_000);

    let vault = setup.escrow_client.get_vault(&vault_id).unwrap();
    assert_eq!(
        vault.milestones.get(0).unwrap().status,
        MilestoneStatus::Refunded
    );

    // Cannot refund again
    let res = setup.escrow_client.try_refund_expired(&vault_id, &1);
    assert_eq!(res, Err(Ok(EscrowError::InvalidStatus)));
}

#[test]
fn test_unauthorized_dispute_raise_fails() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    let unauthorized_user = Address::generate(&setup.env);
    let res = setup
        .escrow_client
        .try_raise_dispute(&vault_id, &1, &unauthorized_user);
    assert_eq!(res, Err(Ok(EscrowError::Unauthorized)));
}

#[test]
fn test_milestone_not_found() {
    let setup = TestSetup::new();
    let vault_id = setup.escrow_client.create_vault(
        &setup.client,
        &setup.freelancer,
        &setup.arbiter,
        &setup.token_client.address,
        &setup.sample_milestones(),
    );

    let res = setup.escrow_client.try_approve_milestone(&vault_id, &999);
    assert_eq!(res, Err(Ok(EscrowError::MilestoneNotFound)));
}

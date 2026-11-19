#![no_std]

pub mod events;
pub mod types;

#[cfg(test)]
mod test;

use events::{
    DisputeRaised, DisputeResolved, MilestoneApproved, MilestoneRefunded, MilestoneSubmitted,
    VaultCreated,
};
use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};
use types::{
    CreateMilestoneInput, DataKey, EscrowError, Milestone, MilestoneStatus, Vault,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS; // ~30 days
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;       // ~120 days

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Create a new milestone escrow vault and fund it with USDC (SAC token).
    pub fn create_vault(
        env: Env,
        client: Address,
        freelancer: Address,
        arbiter: Address,
        token: Address,
        milestones_input: Vec<CreateMilestoneInput>,
    ) -> Result<u64, EscrowError> {
        // Enforce client authorization for deposit and vault creation
        client.require_auth();

        // Validate distinct addresses
        if client == freelancer || client == arbiter || freelancer == arbiter {
            return Err(EscrowError::InvalidAddresses);
        }

        let milestone_count = milestones_input.len();
        if milestone_count == 0 {
            return Err(EscrowError::InvalidMilestoneCount);
        }

        let current_time = env.ledger().timestamp();
        let mut total_amount: i128 = 0;
        let mut milestones: Vec<Milestone> = Vec::new(&env);

        for i in 0..milestone_count {
            let input = milestones_input.get(i).unwrap();

            if input.amount <= 0 {
                return Err(EscrowError::InvalidAmount);
            }
            if input.deadline <= current_time {
                return Err(EscrowError::InvalidDeadline);
            }

            total_amount = total_amount
                .checked_add(input.amount)
                .ok_or(EscrowError::ArithmeticOverflow)?;

            milestones.push_back(Milestone {
                id: i + 1,
                title: input.title,
                amount: input.amount,
                deadline: input.deadline,
                deliverable: String::from_str(&env, ""),
                status: MilestoneStatus::Pending,
            });
        }

        // Transfer funds from client into escrow contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &total_amount);

        // Vault ID allocation
        let vault_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextVaultId)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::NextVaultId, &(vault_id + 1));
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        let vault = Vault {
            id: vault_id,
            client: client.clone(),
            freelancer: freelancer.clone(),
            arbiter: arbiter.clone(),
            token: token.clone(),
            total_amount,
            milestones,
            created_at: current_time,
        };

        // Persist vault and extend TTL
        let vault_key = DataKey::Vault(vault_id);
        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        // Index under client
        let client_key = DataKey::ClientVaults(client.clone());
        let mut client_vaults: Vec<u64> = env
            .storage()
            .persistent()
            .get(&client_key)
            .unwrap_or_else(|| Vec::new(&env));
        client_vaults.push_back(vault_id);
        env.storage().persistent().set(&client_key, &client_vaults);
        env.storage()
            .persistent()
            .extend_ttl(&client_key, BUMP_THRESHOLD, BUMP_TO);

        // Index under freelancer
        let freelancer_key = DataKey::FreelancerVaults(freelancer.clone());
        let mut freelancer_vaults: Vec<u64> = env
            .storage()
            .persistent()
            .get(&freelancer_key)
            .unwrap_or_else(|| Vec::new(&env));
        freelancer_vaults.push_back(vault_id);
        env.storage()
            .persistent()
            .set(&freelancer_key, &freelancer_vaults);
        env.storage()
            .persistent()
            .extend_ttl(&freelancer_key, BUMP_THRESHOLD, BUMP_TO);

        // Emit VaultCreated event
        VaultCreated {
            vault_id,
            client,
            freelancer,
            arbiter,
            token,
            total_amount,
            milestones_count: milestone_count,
        }
        .publish(&env);

        Ok(vault_id)
    }

    /// Submit deliverable for a pending milestone. Only callable by freelancer.
    pub fn submit_milestone(
        env: Env,
        vault_id: u64,
        milestone_id: u32,
        deliverable: String,
    ) -> Result<(), EscrowError> {
        let vault_key = DataKey::Vault(vault_id);
        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&vault_key)
            .ok_or(EscrowError::VaultNotFound)?;

        vault.freelancer.require_auth();

        if deliverable.len() == 0 {
            return Err(EscrowError::EmptyDeliverable);
        }

        let (idx, mut milestone) = Self::find_milestone(&vault, milestone_id)?;

        if milestone.status != MilestoneStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }

        milestone.deliverable = deliverable.clone();
        milestone.status = MilestoneStatus::Submitted;
        vault.milestones.set(idx, milestone);

        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        MilestoneSubmitted {
            vault_id,
            milestone_id,
            freelancer: vault.freelancer,
            deliverable,
        }
        .publish(&env);

        Ok(())
    }

    /// Approve milestone and release funds to freelancer.
    /// Callable by client when milestone is Submitted (or Pending for early release).
    pub fn approve_milestone(
        env: Env,
        vault_id: u64,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        let vault_key = DataKey::Vault(vault_id);
        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&vault_key)
            .ok_or(EscrowError::VaultNotFound)?;

        vault.client.require_auth();

        let (idx, mut milestone) = Self::find_milestone(&vault, milestone_id)?;

        if milestone.status != MilestoneStatus::Submitted
            && milestone.status != MilestoneStatus::Pending
        {
            return Err(EscrowError::InvalidStatus);
        }

        // Transfer milestone amount from contract to freelancer
        let token_client = token::Client::new(&env, &vault.token);
        token_client.transfer(
            &env.current_contract_address(),
            &vault.freelancer,
            &milestone.amount,
        );

        milestone.status = MilestoneStatus::Approved;
        vault.milestones.set(idx, milestone.clone());

        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        MilestoneApproved {
            vault_id,
            milestone_id,
            freelancer: vault.freelancer,
            amount: milestone.amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Raise dispute on a Pending or Submitted milestone.
    /// Caller must be either client or freelancer.
    pub fn raise_dispute(
        env: Env,
        vault_id: u64,
        milestone_id: u32,
        caller: Address,
    ) -> Result<(), EscrowError> {
        let vault_key = DataKey::Vault(vault_id);
        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&vault_key)
            .ok_or(EscrowError::VaultNotFound)?;

        caller.require_auth();

        if caller != vault.client && caller != vault.freelancer {
            return Err(EscrowError::Unauthorized);
        }

        let (idx, mut milestone) = Self::find_milestone(&vault, milestone_id)?;

        if milestone.status != MilestoneStatus::Pending
            && milestone.status != MilestoneStatus::Submitted
        {
            return Err(EscrowError::InvalidStatus);
        }

        milestone.status = MilestoneStatus::Disputed;
        vault.milestones.set(idx, milestone.clone());

        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        DisputeRaised {
            vault_id,
            milestone_id,
            caller,
            amount: milestone.amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Resolve dispute. Only callable by designated arbiter.
    /// If `release_to_freelancer` is true: releases funds to freelancer (Approved).
    /// If false: refunds funds to client (Refunded).
    pub fn resolve_dispute(
        env: Env,
        vault_id: u64,
        milestone_id: u32,
        release_to_freelancer: bool,
    ) -> Result<(), EscrowError> {
        let vault_key = DataKey::Vault(vault_id);
        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&vault_key)
            .ok_or(EscrowError::VaultNotFound)?;

        vault.arbiter.require_auth();

        let (idx, mut milestone) = Self::find_milestone(&vault, milestone_id)?;

        if milestone.status != MilestoneStatus::Disputed {
            return Err(EscrowError::InvalidStatus);
        }

        let token_client = token::Client::new(&env, &vault.token);
        if release_to_freelancer {
            token_client.transfer(
                &env.current_contract_address(),
                &vault.freelancer,
                &milestone.amount,
            );
            milestone.status = MilestoneStatus::Approved;
        } else {
            token_client.transfer(
                &env.current_contract_address(),
                &vault.client,
                &milestone.amount,
            );
            milestone.status = MilestoneStatus::Refunded;
        }

        vault.milestones.set(idx, milestone.clone());

        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        DisputeResolved {
            vault_id,
            milestone_id,
            arbiter: vault.arbiter,
            released_to_freelancer: release_to_freelancer,
            amount: milestone.amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Refund an expired milestone.
    /// Callable by client when milestone is Pending AND current timestamp > milestone.deadline.
    pub fn refund_expired(
        env: Env,
        vault_id: u64,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        let vault_key = DataKey::Vault(vault_id);
        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&vault_key)
            .ok_or(EscrowError::VaultNotFound)?;

        vault.client.require_auth();

        let (idx, mut milestone) = Self::find_milestone(&vault, milestone_id)?;

        if milestone.status != MilestoneStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }

        let current_time = env.ledger().timestamp();
        if current_time <= milestone.deadline {
            return Err(EscrowError::DeadlineNotPassed);
        }

        let token_client = token::Client::new(&env, &vault.token);
        token_client.transfer(
            &env.current_contract_address(),
            &vault.client,
            &milestone.amount,
        );

        milestone.status = MilestoneStatus::Refunded;
        vault.milestones.set(idx, milestone.clone());

        env.storage().persistent().set(&vault_key, &vault);
        env.storage()
            .persistent()
            .extend_ttl(&vault_key, BUMP_THRESHOLD, BUMP_TO);

        MilestoneRefunded {
            vault_id,
            milestone_id,
            client: vault.client,
            amount: milestone.amount,
        }
        .publish(&env);

        Ok(())
    }

    /// Read-only view: Fetch vault details by ID.
    pub fn get_vault(env: Env, vault_id: u64) -> Option<Vault> {
        let key = DataKey::Vault(vault_id);
        let vault: Option<Vault> = env.storage().persistent().get(&key);
        if vault.is_some() {
            env.storage()
                .persistent()
                .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
        vault
    }

    /// Read-only view: Get all vault IDs associated with a client.
    pub fn get_client_vaults(env: Env, client: Address) -> Vec<u64> {
        let key = DataKey::ClientVaults(client);
        let vaults: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        if vaults.len() > 0 {
            env.storage()
                .persistent()
                .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
        vaults
    }

    /// Read-only view: Get all vault IDs associated with a freelancer.
    pub fn get_freelancer_vaults(env: Env, freelancer: Address) -> Vec<u64> {
        let key = DataKey::FreelancerVaults(freelancer);
        let vaults: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        if vaults.len() > 0 {
            env.storage()
                .persistent()
                .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        }
        vaults
    }

    // --- Helper function ---
    fn find_milestone(vault: &Vault, milestone_id: u32) -> Result<(u32, Milestone), EscrowError> {
        for i in 0..vault.milestones.len() {
            let m = vault.milestones.get(i).unwrap();
            if m.id == milestone_id {
                return Ok((i, m));
            }
        }
        Err(EscrowError::MilestoneNotFound)
    }
}

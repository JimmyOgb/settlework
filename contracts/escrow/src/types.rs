use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowError {
    VaultNotFound = 1,
    MilestoneNotFound = 2,
    InvalidAmount = 3,
    InvalidMilestoneCount = 4,
    InvalidDeadline = 5,
    InvalidAddresses = 6,
    Unauthorized = 7,
    InvalidStatus = 8,
    DeadlineNotPassed = 9,
    EmptyDeliverable = 10,
    ArithmeticOverflow = 11,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MilestoneStatus {
    Pending = 1,
    Submitted = 2,
    Approved = 3,
    Disputed = 4,
    Refunded = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub amount: i128,
    pub deadline: u64,
    pub deliverable: String,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateMilestoneInput {
    pub title: String,
    pub amount: i128,
    pub deadline: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vault {
    pub id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
    pub milestones: Vec<Milestone>,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    NextVaultId,
    Vault(u64),
    ClientVaults(Address),
    FreelancerVaults(Address),
}

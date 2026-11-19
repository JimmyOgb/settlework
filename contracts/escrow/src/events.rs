use soroban_sdk::{contractevent, Address, String};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultCreated {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub client: Address,
    #[topic]
    pub freelancer: Address,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
    pub milestones_count: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneSubmitted {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub milestone_id: u32,
    #[topic]
    pub freelancer: Address,
    pub deliverable: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneApproved {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub milestone_id: u32,
    #[topic]
    pub freelancer: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeRaised {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub milestone_id: u32,
    #[topic]
    pub caller: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeResolved {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub milestone_id: u32,
    #[topic]
    pub arbiter: Address,
    pub released_to_freelancer: bool,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneRefunded {
    #[topic]
    pub vault_id: u64,
    #[topic]
    pub milestone_id: u32,
    #[topic]
    pub client: Address,
    pub amount: i128,
}

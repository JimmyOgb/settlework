import {Address} from '@stellar/stellar-sdk';

    /**
 * Struct: Vault
 */
export interface Vault {
  arbiter: string;
  client: string;
  created_at: bigint;
  freelancer: string;
  id: bigint;
  milestones: Array<Milestone>;
  token: string;
  total_amount: bigint;
}

/**
 * Struct: Milestone
 */
export interface Milestone {
  amount: bigint;
  deadline: bigint;
  deliverable: string;
  id: number;
  status: MilestoneStatus;
  title: string;
}

/**
 * Error Enum: EscrowError
 */
export const EscrowError = {
  1 : { message: "VaultNotFound" },
  2 : { message: "MilestoneNotFound" },
  3 : { message: "InvalidAmount" },
  4 : { message: "InvalidMilestoneCount" },
  5 : { message: "InvalidDeadline" },
  6 : { message: "InvalidAddresses" },
  7 : { message: "Unauthorized" },
  8 : { message: "InvalidStatus" },
  9 : { message: "DeadlineNotPassed" },
  10 : { message: "EmptyDeliverable" },
  11 : { message: "ArithmeticOverflow" }
};
export type EscrowError = typeof EscrowError[keyof typeof EscrowError];

/**
 * Enum: MilestoneStatus
 */
export enum MilestoneStatus {
  /**
   * Enum Case: Pending
   */
  Pending = 1,
  /**
   * Enum Case: Submitted
   */
  Submitted = 2,
  /**
   * Enum Case: Approved
   */
  Approved = 3,
  /**
   * Enum Case: Disputed
   */
  Disputed = 4,
  /**
   * Enum Case: Refunded
   */
  Refunded = 5
}

/**
 * Struct: CreateMilestoneInput
 */
export interface CreateMilestoneInput {
  amount: bigint;
  deadline: bigint;
  title: string;
}

/**
 * Event: VaultCreated
 */
export interface VaultCreatedEvent {
  name: "VaultCreated";
  data: {
    vault_id: bigint;
    client: string;
    freelancer: string;
    arbiter?: string;
    token?: string;
    total_amount?: bigint;
    milestones_count?: number;
  };
}

/**
 * Event: DisputeRaised
 */
export interface DisputeRaisedEvent {
  name: "DisputeRaised";
  data: {
    vault_id: bigint;
    milestone_id: number;
    caller: string;
    amount?: bigint;
  };
}

/**
 * Event: DisputeResolved
 */
export interface DisputeResolvedEvent {
  name: "DisputeResolved";
  data: {
    vault_id: bigint;
    milestone_id: number;
    arbiter: string;
    released_to_freelancer?: boolean;
    amount?: bigint;
  };
}

/**
 * Event: MilestoneApproved
 */
export interface MilestoneApprovedEvent {
  name: "MilestoneApproved";
  data: {
    vault_id: bigint;
    milestone_id: number;
    freelancer: string;
    amount?: bigint;
  };
}

/**
 * Event: MilestoneRefunded
 */
export interface MilestoneRefundedEvent {
  name: "MilestoneRefunded";
  data: {
    vault_id: bigint;
    milestone_id: number;
    client: string;
    amount?: bigint;
  };
}

/**
 * Event: MilestoneSubmitted
 */
export interface MilestoneSubmittedEvent {
  name: "MilestoneSubmitted";
  data: {
    vault_id: bigint;
    milestone_id: number;
    freelancer: string;
    deliverable?: string;
  };
}
    export type ContractEvent = VaultCreatedEvent | DisputeRaisedEvent | DisputeResolvedEvent | MilestoneApprovedEvent | MilestoneRefundedEvent | MilestoneSubmittedEvent;
    
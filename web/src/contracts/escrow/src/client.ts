import {Vault, CreateMilestoneInput, EscrowError, ContractEvent} from './types.js';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  /**
   * Read-only view: Fetch vault details by ID.
   */
  get_vault(args: { vault_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Vault | null>>;
  /**
   * Create a new milestone escrow vault and fund it with USDC (SAC token).
   */
  create_vault(args: { client: string | Address; freelancer: string | Address; arbiter: string | Address; token: string | Address; milestones_input: Array<CreateMilestoneInput> }, options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, EscrowError>>>;
  /**
   * Raise dispute on a Pending or Submitted milestone.
   * Caller must be either client or freelancer.
   */
  raise_dispute(args: { vault_id: bigint; milestone_id: number; caller: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, EscrowError>>>;
  /**
   * Refund an expired milestone.
   * Callable by client when milestone is Pending AND current timestamp > milestone.deadline.
   */
  refund_expired(args: { vault_id: bigint; milestone_id: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, EscrowError>>>;
  /**
   * Resolve dispute. Only callable by designated arbiter.
   * If `release_to_freelancer` is true: releases funds to freelancer (Approved).
   * If false: refunds funds to client (Refunded).
   */
  resolve_dispute(args: { vault_id: bigint; milestone_id: number; release_to_freelancer: boolean }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, EscrowError>>>;
  /**
   * Submit deliverable for a pending milestone. Only callable by freelancer.
   */
  submit_milestone(args: { vault_id: bigint; milestone_id: number; deliverable: string }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, EscrowError>>>;
  /**
   * Approve milestone and release funds to freelancer.
   * Callable by client when milestone is Submitted (or Pending for early release).
   */
  approve_milestone(args: { vault_id: bigint; milestone_id: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, EscrowError>>>;
  /**
   * Read-only view: Get all vault IDs associated with a client.
   */
  get_client_vaults(args: { client: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Array<bigint>>>;
  /**
   * Read-only view: Get all vault IDs associated with a freelancer.
   */
  get_freelancer_vaults(args: { freelancer: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Array<bigint>>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAACpSZWFkLW9ubHkgdmlldzogRmV0Y2ggdmF1bHQgZGV0YWlscyBieSBJRC4AAAAAAAlnZXRfdmF1bHQAAAAAAAABAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAABAAAD6AAAB9AAAAAFVmF1bHQAAAA=", "AAAAAAAAAEZDcmVhdGUgYSBuZXcgbWlsZXN0b25lIGVzY3JvdyB2YXVsdCBhbmQgZnVuZCBpdCB3aXRoIFVTREMgKFNBQyB0b2tlbikuAAAAAAAMY3JlYXRlX3ZhdWx0AAAABQAAAAAAAAAGY2xpZW50AAAAAAATAAAAAAAAAApmcmVlbGFuY2VyAAAAAAATAAAAAAAAAAdhcmJpdGVyAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAQbWlsZXN0b25lc19pbnB1dAAAA+oAAAfQAAAAFENyZWF0ZU1pbGVzdG9uZUlucHV0AAAAAQAAA+kAAAAGAAAH0AAAAAtFc2Nyb3dFcnJvcgA=", "AAAAAAAAAF5SYWlzZSBkaXNwdXRlIG9uIGEgUGVuZGluZyBvciBTdWJtaXR0ZWQgbWlsZXN0b25lLgpDYWxsZXIgbXVzdCBiZSBlaXRoZXIgY2xpZW50IG9yIGZyZWVsYW5jZXIuAAAAAAANcmFpc2VfZGlzcHV0ZQAAAAAAAAMAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=", "AAAAAAAAAHVSZWZ1bmQgYW4gZXhwaXJlZCBtaWxlc3RvbmUuCkNhbGxhYmxlIGJ5IGNsaWVudCB3aGVuIG1pbGVzdG9uZSBpcyBQZW5kaW5nIEFORCBjdXJyZW50IHRpbWVzdGFtcCA+IG1pbGVzdG9uZS5kZWFkbGluZS4AAAAAAAAOcmVmdW5kX2V4cGlyZWQAAAAAAAIAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAEAAAPpAAAAAgAAB9AAAAALRXNjcm93RXJyb3IA", "AAAAAAAAALBSZXNvbHZlIGRpc3B1dGUuIE9ubHkgY2FsbGFibGUgYnkgZGVzaWduYXRlZCBhcmJpdGVyLgpJZiBgcmVsZWFzZV90b19mcmVlbGFuY2VyYCBpcyB0cnVlOiByZWxlYXNlcyBmdW5kcyB0byBmcmVlbGFuY2VyIChBcHByb3ZlZCkuCklmIGZhbHNlOiByZWZ1bmRzIGZ1bmRzIHRvIGNsaWVudCAoUmVmdW5kZWQpLgAAAA9yZXNvbHZlX2Rpc3B1dGUAAAAAAwAAAAAAAAAIdmF1bHRfaWQAAAAGAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAAAAABVyZWxlYXNlX3RvX2ZyZWVsYW5jZXIAAAAAAAABAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=", "AAAAAAAAAEhTdWJtaXQgZGVsaXZlcmFibGUgZm9yIGEgcGVuZGluZyBtaWxlc3RvbmUuIE9ubHkgY2FsbGFibGUgYnkgZnJlZWxhbmNlci4AAAAQc3VibWl0X21pbGVzdG9uZQAAAAMAAAAAAAAACHZhdWx0X2lkAAAABgAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAALZGVsaXZlcmFibGUAAAAAEAAAAAEAAAPpAAAAAgAAB9AAAAALRXNjcm93RXJyb3IA", "AAAAAAAAAIFBcHByb3ZlIG1pbGVzdG9uZSBhbmQgcmVsZWFzZSBmdW5kcyB0byBmcmVlbGFuY2VyLgpDYWxsYWJsZSBieSBjbGllbnQgd2hlbiBtaWxlc3RvbmUgaXMgU3VibWl0dGVkIChvciBQZW5kaW5nIGZvciBlYXJseSByZWxlYXNlKS4AAAAAAAARYXBwcm92ZV9taWxlc3RvbmUAAAAAAAACAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==", "AAAAAAAAADtSZWFkLW9ubHkgdmlldzogR2V0IGFsbCB2YXVsdCBJRHMgYXNzb2NpYXRlZCB3aXRoIGEgY2xpZW50LgAAAAARZ2V0X2NsaWVudF92YXVsdHMAAAAAAAABAAAAAAAAAAZjbGllbnQAAAAAABMAAAABAAAD6gAAAAY=", "AAAAAAAAAD9SZWFkLW9ubHkgdmlldzogR2V0IGFsbCB2YXVsdCBJRHMgYXNzb2NpYXRlZCB3aXRoIGEgZnJlZWxhbmNlci4AAAAAFWdldF9mcmVlbGFuY2VyX3ZhdWx0cwAAAAAAAAEAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAABAAAD6gAAAAY=", "AAAAAQAAAAAAAAAAAAAABVZhdWx0AAAAAAAACAAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAAAAAAZjbGllbnQAAAAAABMAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAptaWxlc3RvbmVzAAAAAAPqAAAH0AAAAAlNaWxlc3RvbmUAAAAAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAMdG90YWxfYW1vdW50AAAACw==", "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAtkZWxpdmVyYWJsZQAAAAAQAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAD01pbGVzdG9uZVN0YXR1cwAAAAAAAAAABXRpdGxlAAAAAAAAEA==", "AAAABAAAAAAAAAAAAAAAC0VzY3Jvd0Vycm9yAAAAAAsAAAAAAAAADVZhdWx0Tm90Rm91bmQAAAAAAAABAAAAAAAAABFNaWxlc3RvbmVOb3RGb3VuZAAAAAAAAAIAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAADAAAAAAAAABVJbnZhbGlkTWlsZXN0b25lQ291bnQAAAAAAAAEAAAAAAAAAA9JbnZhbGlkRGVhZGxpbmUAAAAABQAAAAAAAAAQSW52YWxpZEFkZHJlc3NlcwAAAAYAAAAAAAAADFVuYXV0aG9yaXplZAAAAAcAAAAAAAAADUludmFsaWRTdGF0dXMAAAAAAAAIAAAAAAAAABFEZWFkbGluZU5vdFBhc3NlZAAAAAAAAAkAAAAAAAAAEEVtcHR5RGVsaXZlcmFibGUAAAAKAAAAAAAAABJBcml0aG1ldGljT3ZlcmZsb3cAAAAAAAs=", "AAAAAwAAAAAAAAAAAAAAD01pbGVzdG9uZVN0YXR1cwAAAAAFAAAAAAAAAAdQZW5kaW5nAAAAAAEAAAAAAAAACVN1Ym1pdHRlZAAAAAAAAAIAAAAAAAAACEFwcHJvdmVkAAAAAwAAAAAAAAAIRGlzcHV0ZWQAAAAEAAAAAAAAAAhSZWZ1bmRlZAAAAAU=", "AAAAAQAAAAAAAAAAAAAAFENyZWF0ZU1pbGVzdG9uZUlucHV0AAAAAwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAABXRpdGxlAAAAAAAAEA==", "AAAABQAAAAAAAAAAAAAADFZhdWx0Q3JlYXRlZAAAAAEAAAANdmF1bHRfY3JlYXRlZAAAAAAAAAcAAAAAAAAACHZhdWx0X2lkAAAABgAAAAEAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAABAAAAAAAAAAdhcmJpdGVyAAAAABMAAAAAAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAAAAAAAx0b3RhbF9hbW91bnQAAAALAAAAAAAAAAAAAAAQbWlsZXN0b25lc19jb3VudAAAAAQAAAAAAAAAAg==", "AAAABQAAAAAAAAAAAAAADURpc3B1dGVSYWlzZWQAAAAAAAABAAAADmRpc3B1dGVfcmFpc2VkAAAAAAAEAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAABAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAAD0Rpc3B1dGVSZXNvbHZlZAAAAAABAAAAEGRpc3B1dGVfcmVzb2x2ZWQAAAAFAAAAAAAAAAh2YXVsdF9pZAAAAAYAAAABAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAQAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAQAAAAAAAAAWcmVsZWFzZWRfdG9fZnJlZWxhbmNlcgAAAAAAAQAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAAEU1pbGVzdG9uZUFwcHJvdmVkAAAAAAAAAQAAABJtaWxlc3RvbmVfYXBwcm92ZWQAAAAAAAQAAAAAAAAACHZhdWx0X2lkAAAABgAAAAEAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAABAAAAAAAAAApmcmVlbGFuY2VyAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAAEU1pbGVzdG9uZVJlZnVuZGVkAAAAAAAAAQAAABJtaWxlc3RvbmVfcmVmdW5kZWQAAAAAAAQAAAAAAAAACHZhdWx0X2lkAAAABgAAAAEAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAABAAAAAAAAAAZjbGllbnQAAAAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==", "AAAABQAAAAAAAAAAAAAAEk1pbGVzdG9uZVN1Ym1pdHRlZAAAAAAAAQAAABNtaWxlc3RvbmVfc3VibWl0dGVkAAAAAAQAAAAAAAAACHZhdWx0X2lkAAAABgAAAAEAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAABAAAAAAAAAApmcmVlbGFuY2VyAAAAAAATAAAAAQAAAAAAAAALZGVsaXZlcmFibGUAAAAAEAAAAAAAAAAC"]),
      options
    );
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJson = {
    get_vault : this.txFromJson<Vault | null>,  create_vault : this.txFromJson<Result<bigint, EscrowError>>,  raise_dispute : this.txFromJson<Result<null, EscrowError>>,  refund_expired : this.txFromJson<Result<null, EscrowError>>,  resolve_dispute : this.txFromJson<Result<null, EscrowError>>,  submit_milestone : this.txFromJson<Result<null, EscrowError>>,  approve_milestone : this.txFromJson<Result<null, EscrowError>>,  get_client_vaults : this.txFromJson<Array<bigint>>,  get_freelancer_vaults : this.txFromJson<Array<bigint>>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "VaultCreated" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  vaultCreatedEventFilter(topicValues?: { vault_id?: bigint; client?: string | Address; freelancer?: string | Address }): string[] {
    return this.spec.eventTopicFilter("VaultCreated", topicValues);
  }
  /**
   * Build a topics filter row for the "DisputeRaised" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  disputeRaisedEventFilter(topicValues?: { vault_id?: bigint; milestone_id?: number; caller?: string | Address }): string[] {
    return this.spec.eventTopicFilter("DisputeRaised", topicValues);
  }
  /**
   * Build a topics filter row for the "DisputeResolved" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  disputeResolvedEventFilter(topicValues?: { vault_id?: bigint; milestone_id?: number; arbiter?: string | Address }): string[] {
    return this.spec.eventTopicFilter("DisputeResolved", topicValues);
  }
  /**
   * Build a topics filter row for the "MilestoneApproved" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  milestoneApprovedEventFilter(topicValues?: { vault_id?: bigint; milestone_id?: number; freelancer?: string | Address }): string[] {
    return this.spec.eventTopicFilter("MilestoneApproved", topicValues);
  }
  /**
   * Build a topics filter row for the "MilestoneRefunded" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  milestoneRefundedEventFilter(topicValues?: { vault_id?: bigint; milestone_id?: number; client?: string | Address }): string[] {
    return this.spec.eventTopicFilter("MilestoneRefunded", topicValues);
  }
  /**
   * Build a topics filter row for the "MilestoneSubmitted" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  milestoneSubmittedEventFilter(topicValues?: { vault_id?: bigint; milestone_id?: number; freelancer?: string | Address }): string[] {
    return this.spec.eventTopicFilter("MilestoneSubmitted", topicValues);
  }
}
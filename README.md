# SettleWork

> **Decentralized Milestone Escrow & African Fiat (NGN/GHS) Off-Ramp dApp on Stellar**

SettleWork protects clients and freelancers in cross-border professional agreements. Built natively on Stellar Soroban smart contracts using the SEP-41 token standard for USDC, SettleWork enables milestone-locked funds with automated release, dispute arbitration, and seamless local fiat withdrawals into Nigerian Naira (NGN) and Ghanaian Cedis (GHS) via Stellar Anchors.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |               CLIENT                  |
                      | (Passkey / WebAuthn / Smart Account)  |
                      +-------------------+-------------------+
                                          |
                        1. create_vault() | (Transfers USDC to Escrow)
                                          v
+---------------------------------------------------------------------------------+
|                       SOROBAN MILESTONE ESCROW CONTRACT                         |
|                                                                                 |
|  Vault Storage (Persistent):                                                    |
|    - Client, Freelancer, Arbiter, Token (USDC)                                  |
|    - Milestones: [ { id, title, amount, deadline, deliverable, status } ]       |
|    - State Transitions: Pending -> Submitted -> Approved | Disputed | Refunded  |
|    - Storage Rent: Auto-extended TTL (30-day bump threshold / 120-day ceiling)  |
+-------------------+-----------------------------------+-------------------------+
                    |                                   |
  2. submit_        | 3. approve_                       | 4. resolve_dispute()
     milestone()    |    milestone()                    |    (or refund_expired)
                    v                                   v
+-------------------+-------------------+       +-------+-------------------------+
|              FREELANCER               |       |                ARBITER          |
| (Passkey / WebAuthn / Smart Account)  |       |       (Dispute Resolution)      |
+-------------------+-------------------+       +---------------------------------+
                    |
                    | (USDC Released)
                    v
+---------------------------------------------------------------------------------+
|                  STELLAR ANCHOR OFF-RAMP RAIL (SEP-24 / SEP-31)                 |
|                                                                                 |
|  USDC -> Local Fiat Settlement:                                                 |
|    - NGN: Nigerian Bank Accounts / NIP Instant Transfer                         |
|    - GHS: MTN MoMo / Vodafone Cash / Bank Accounts                              |
+---------------------------------------------------------------------------------+
```

---

## Monorepo Layout

```
settlework/
├── .agents/
│   ├── mcp_config.json                 # Stellar Docs MCP configuration
│   └── skills/                         # Stellar, Soroban, Passkey & Anchor skills
│       ├── smart-contracts/            # Rust soroban-sdk & SAC best practices
│       ├── dapp/                       # Smart accounts, passkeys & wallet kit
│       ├── assets/                     # Classic assets & SEP-41 SAC bridge
│       ├── standards/                  # SEPs and CAPs references
│       ├── data/                       # Stellar RPC and indexer patterns
│       ├── stellar-anchor-skill/       # SEP-10/24/31/38 fiat off-ramp guide
│       └── agent-browser-webauthn/     # CDP virtual WebAuthn browser testing
├── contracts/
│   └── escrow/                         # Rust Soroban smart contract
│       ├── Cargo.toml                  # Contract package definition (soroban-sdk v29)
│       └── src/
│           ├── lib.rs                  # Core escrow contract implementation
│           ├── types.rs                # Vault, Milestone, MilestoneStatus & DataKey
│           ├── events.rs               # Contract events (VaultCreated, Dispute, etc.)
│           └── test.rs                 # Comprehensive unit tests with mock SAC token
├── web/                                # Placeholder for Phase 2 Frontend (React + Vite)
├── Cargo.toml                          # Workspace root with wasm release profile
└── README.md                           # Project documentation
```

---

## Escrow Contract Specification

### Milestone State Lifecycle

```
             +-----------------------+
             |        Pending        |<-------------------+
             +-----------+-----------+                    |
                         |                                |
        submit_milestone | (freelancer)                   |
                         v                                |
             +-----------------------+                    |
             |       Submitted       |                    |
             +---+---------------+---+                    |
                 |               |                        |
approve_milestone| raise_dispute | raise_dispute          | refund_expired
  (client)       | (either party)| (either party)         | (if deadline passed)
                 v               v                        v
         +-----------+   +---------------+        +---------------+
         | Approved  |   |   Disputed    |        |   Refunded    |
         +-----------+   +-------+-------+        +---------------+
                                 |
                  resolve_dispute| (arbiter)
                 +---------------+---------------+
                 |                               |
       (favor freelancer)                  (favor client)
                 v                               v
         +-----------+                    +---------------+
         | Approved  |                    |   Refunded    |
         +-----------+                    +---------------+
```

### Core Functions

| Function | Authorization | Description |
| :--- | :--- | :--- |
| `create_vault(client, freelancer, arbiter, token, milestones)` | `client.require_auth()` | Locks total USDC into escrow contract; initializes vault and indexes under client and freelancer. |
| `submit_milestone(vault_id, milestone_id, deliverable)` | `freelancer.require_auth()` | Updates deliverable URL/hash and marks milestone as `Submitted`. |
| `approve_milestone(vault_id, milestone_id)` | `client.require_auth()` | Releases milestone amount from contract to freelancer (`Approved`). Allows early release from `Pending`. |
| `raise_dispute(vault_id, milestone_id, caller)` | `caller.require_auth()` | Freezes milestone in `Disputed` state. Caller must be client or freelancer. |
| `resolve_dispute(vault_id, milestone_id, release_to_freelancer)` | `arbiter.require_auth()` | Arbiter decides outcome: releases funds to freelancer (`Approved`) or refunds client (`Refunded`). |
| `refund_expired(vault_id, milestone_id)` | `client.require_auth()` | Refunds client if milestone is `Pending` and current ledger timestamp exceeds deadline. |
| `get_vault(vault_id)` | *None (Read-only)* | Retrieves complete vault details and milestone states. |
| `get_client_vaults(client)` | *None (Read-only)* | Returns list of all vault IDs where address is the client. |
| `get_freelancer_vaults(freelancer)` | *None (Read-only)* | Returns list of all vault IDs where address is the freelancer. |

---

## Build & Test Instructions

### Prerequisites
- [Rust](https://rustup.rs/) (>= 1.84) with `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) (>= 30.0.1)

### 1. Run Unit Tests
Run the comprehensive test suite with mock SAC token clients:
```bash
cargo test --lib
```

All 9 unit tests verify:
- Vault creation, token deduction, and user indexing
- Parameter validations (duplicate addresses, zero amounts, past deadlines)
- Normal milestone submission and client approval
- Early client approval without prior submission
- Dispute escalation and arbiter resolution (in favor of freelancer and client)
- Expired milestone refund logic and deadline enforcement
- Strict authentication barriers and unauthorized caller rejection

### 2. Compile to WebAssembly
Compile the optimized Soroban Wasm bytecode using Stellar CLI:
```bash
stellar contract build
```

The optimized artifact is output to:
```
target/wasm32v1-none/release/settlework_escrow.wasm (~13 KB)
```

---

## Phase 2 Roadmap
- **Frontend dApp (`web/`)**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- **Smart Accounts / Passkeys**: WebAuthn passkey wallet creation and signing via Stellar Smart Account Kit.
- **Off-Ramp Integration**: SEP-24 / SEP-31 interactive off-ramp modals supporting NGN (Nigeria) and GHS (Ghana) corridors.
- **Contract Client**: Automated TypeScript bindings generated from contract Wasm specification.

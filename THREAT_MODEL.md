# Threat Model

This document describes the security boundaries of the Envelope budgeting system: what we explicitly defend against, what we do not, and the assumptions the system relies on. It is intended for outside reviewers and prospective users evaluating trust.

For the design rationale behind these decisions, see [CLAUDE.md](CLAUDE.md) and [README.md](README.md).

---

## In Scope — Threats We Defend Against

### Compromised manager wallet

**Threat:** An attacker gains control of a manager wallet (e.g. a hot wallet, mobile wallet, or automation server key).

**Defense:** The manager role is intentionally limited. A manager can move funds between envelopes and send funds to the withdrawal address, but cannot change the withdrawal address or send funds to an arbitrary address. The worst-case outcome is funds routed to the pre-approved withdrawal address, which only the admin controls. The admin can revoke a manager's role at any time.

This bounded blast radius is a core design constraint. See [README.md — Security Model](README.md#security-model).

---

### Unauthorized callers to Envelope contracts

**Threat:** An attacker calls `sendFunds()` or `rescueToken()` directly on an Envelope contract, bypassing the Portfolio.

**Defense:** Each Envelope stores the address of the Portfolio that deployed it as an immutable field. All transfer functions revert if `msg.sender` is not that Portfolio address. There is no way to upgrade or override this check.

---

### Reentrancy on fund-moving paths

**Threat:** A reentrant call during a token transfer drains more funds than authorized.

**Defense:** The portfolio uses OpenZeppelin's `SafeERC20` for all token transfers. USDC (the primary token) is not a reentrant token, but the use of `SafeERC20` provides defense-in-depth. Slither is run in CI to flag reentrancy patterns.

---

### ETH accidentally sent to the contracts

**Threat:** ETH is sent to a Portfolio or Envelope address, becoming permanently stuck.

**Defense:** Both `Portfolio.sol` and `Envelope.sol` implement a `receive()` function that reverts with `ETHNotAccepted`. ETH cannot be deposited.

---

### Stray ERC-20 tokens sent to an Envelope

**Threat:** Someone accidentally sends an unrelated ERC-20 token to an envelope address, where it would otherwise be permanently inaccessible.

**Defense:** `Portfolio.rescueTokenFromEnvelope()` allows the admin to recover stray tokens from an envelope. The rescue destination is always the withdrawal address — never an arbitrary address. Rescuing the primary token (USDC) is explicitly prohibited; use `withdrawFromEnvelope()` for that.

---

### Admin key handed off insecurely

**Threat:** An admin transfer is executed in a single step; if the new address is wrong (typo, clipboard hijack), admin is permanently lost or transferred to an attacker.

**Defense:** Admin transfer is a two-step process. The current admin calls `proposeAdmin(newAdmin)`, and the proposed address must call `acceptAdmin()` to complete the transfer. If the wrong address is proposed, the current admin can call `cancelPendingAdmin()` before the handoff is accepted.

---

## Out of Scope — Threats We Do Not Defend Against

### Compromised admin key

**Risk:** An attacker who gains control of the admin wallet has full control of the portfolio. They can change the withdrawal address and drain all funds.

**Why out of scope:** Defending against a compromised admin key requires trusted execution environments or multi-party computation that are out of scope for v1.

**Recommended mitigation:** Use a hardware wallet (Ledger, Trezor) or a multisig (Safe) for the admin role. Do not use a hot wallet as admin.

---

### Malicious or non-standard USDC contract

**Risk:** If the USDC contract at the configured address behaves unexpectedly — e.g. it has a fee-on-transfer, pauses transfers, or blacklists the portfolio address — funds could be locked or lost.

**Why out of scope:** We assume USDC behaves as a standard ERC-20 (see Assumptions below). We do not validate token behavior at deploy time beyond checking that the address has code.

**Note:** If USDC blacklists the portfolio or an envelope address, funds held there would be permanently inaccessible. This is a risk inherent to using a permissioned stablecoin.

---

### Frontend compromise

**Risk:** The GitHub Pages deployment, the maintainer's GitHub account, or npm dependencies could be compromised, serving a malicious frontend that tricks users into signing harmful transactions.

**Why out of scope:** The contracts are the source of truth. A compromised frontend cannot move funds without user wallet signatures, but it could deceive a user into signing a malicious transaction.

**Recommended mitigation:** Verify contract addresses against the README before connecting. Consider self-hosting the frontend from a known-good build.

---

### User signs a malicious transaction

**Risk:** A user can be deceived (by a phishing site, wallet drainer, or malicious dApp) into signing a transaction that calls `addManager()` with an attacker-controlled address, or `setWithdrawalAddress()` with an attacker-controlled destination, or directly approves a token spend.

**Why out of scope:** This is a general wallet security problem, not a contract design problem. The contracts enforce access control correctly; the attack requires the legitimate key holder to sign.

---

### MEV / sandwich attacks on deposits

**Risk:** Deposits are public mempool transactions. An MEV bot could observe a deposit and attempt to sandwich it.

**Why out of scope:** Deposits go into the unallocated balance of the portfolio. There is no price or slippage to exploit — there is no swap. MEV has no economic incentive here.

---

### Front-running of allocate / move operations

**Risk:** An attacker observes a pending `allocate()` or `moveFunds()` transaction and submits a competing transaction first.

**Why out of scope:** Fund movements within the portfolio have exactly one possible destination: another envelope address controlled by the same portfolio, or the pre-set withdrawal address. There is no economic incentive to front-run these operations — an attacker cannot redirect funds to themselves.

---

### Base L2 reorgs

**Risk:** A shallow chain reorganization on Base could reverse a recently confirmed transaction.

**Why out of scope:** Base's reorg depth is very shallow in practice. We accept the same finality assumptions as any application deployed on Base. Wait for sufficient confirmations before treating a deposit as final.

---

## Assumptions

The system's security relies on the following assumptions being true:

| Assumption | Notes |
|---|---|
| USDC behaves as a standard ERC-20 with no fee-on-transfer | Confirmed for USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| The admin key is held securely (hardware wallet or multisig) | Without this, all other protections are moot |
| Users verify contract addresses against the README before connecting | Prevents interaction with a counterfeit portfolio |
| Base L2 finality and reorg behavior is acceptable for the use case | Standard assumption for any Base deployment |
| The Solidity 0.8.x compiler and OpenZeppelin libraries are not compromised | Standard supply-chain assumption |

---

## No Security Audit

This project has not been audited by a third-party security firm. The contracts are experimental. Do not use them to hold funds you cannot afford to lose.

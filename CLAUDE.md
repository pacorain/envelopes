# CLAUDE.md — Envelope Budgeting dApp

This file documents architectural decisions and their rationale for use by AI coding assistants. When in doubt about a design choice, consult this file before suggesting alternatives. Many decisions here were made deliberately after evaluating tradeoffs — do not refactor away from them without explicit instruction.

See `README.md` for project overview, feature descriptions, and stack rationale.

---

## Working with GitHub Issues

When asked to work on a GitHub issue, **wait for the GitHub MCP tools to become available** before attempting to read the issue. These tools load asynchronously at session start and may not be ready immediately.

If a tool like `mcp__github__issue_read` is not yet available, use `ToolSearch` to look it up — this will trigger it to load. Do not try to access GitHub via the `gh` CLI or `WebFetch`; the repo is private and those methods will fail.

---

## Contract Architecture

### Two-contract model: Portfolio + Envelope

Each portfolio consists of one `Portfolio.sol` and one `Envelope.sol` per named allocation. Envelopes are deployed by the Portfolio at runtime via `createEnvelope()`.

**Why separate Envelope contracts instead of a mapping?**
Envelopes are real on-chain addresses. This means:
- Funds can be deposited directly to a specific envelope by any external sender (payroll, another contract, recurring transfer) without going through the Portfolio UI
- Envelope balances are inspectable with standard on-chain tooling
- The architecture is composable with future extensions

The gas cost of deploying Envelope contracts is acceptable on Base (L2). This is not a concern.

### Envelope as dumb vault — Portfolio as sole authorized caller

Envelope contracts hold funds and expose transfer functions, but contain **no authorization logic**. All permission checks live exclusively in `Portfolio.sol`. Envelope functions are callable **only by the Portfolio contract address that deployed them**.

**Do not add authorization logic to Envelope.sol.** It was explicitly decided that putting trust logic in two places increases audit surface without meaningful benefit. The Portfolio is the single entry point for all operations.

### No ETH — ERC-20 (USDC) only

The primary token is USDC. Native ETH is not a design target. Balance tracking uses `IERC20.balanceOf()`, not `address(this).balance`. Direct deposits to an envelope address work via standard ERC-20 transfers — no `receive()` function is needed for that purpose.

### Unallocated balance

The Portfolio tracks an `unallocated` balance: funds deposited at the portfolio level that have not yet been routed to an envelope. This is the "inbox" and is the balance the allocation UI operates on. It is distinct from envelope balances.

---

## Access Control

### Two roles only (v1)

- **Admin** — privileged operations: set withdrawal address, add/remove managers, withdraw unallocated funds
- **Manager** — operational access: create envelopes, move funds between envelopes, send to withdrawal address

Do not introduce additional roles or OpenZeppelin `AccessControl` in v1. A simple `mapping(address => bool)` for managers and a single `admin` address is sufficient and easier to audit.

### Withdrawal address as the only external escape valve

The withdrawal address is the **only address to which funds can leave the portfolio**. Only the admin can set or change it.

Managers can send funds *to* the withdrawal address but cannot change it. This means a compromised manager wallet can route funds to the withdrawal address (which the admin controls) but cannot drain to an arbitrary attacker address.

**Do not add any function that allows funds to be sent to an arbitrary address by any role.** This constraint is fundamental to the security model.

### Roles model key security tiers, not users

The admin role is intended for a cold wallet (Ledger, multisig). The manager role is intended for hot wallets (mobile wallet, Coinbase smart wallet). The same person typically holds both roles via different wallet types.

---

## Automation Server

An optional server component can be granted the **manager role** as a regular wallet. It operates within the same permission constraints as any other manager — no special trust, no special contract access. The admin can revoke its manager role at any time.

The server is intended to monitor transactions (via Coinbase API and on-chain events) and automatically route funds based on user-defined rules. It should be self-hostable and stateless where possible — the chain is the source of truth.

---

## Deployment Model

### v1: Direct deploy from UI

`Portfolio.sol` is deployed directly from the frontend using ethers.js. The contract address is persisted in `localStorage`. There is no on-chain registry.

**Known v1 limitations (do not try to fix these in v1):**
- Portfolio address is lost if localStorage is cleared or browser is switched
- No discovery of portfolios by wallet address

### v2: Factory + registry (planned)

`PortfolioFactory.sol` will deploy Portfolio instances and maintain a registry. The factory address will be a config constant in the UI. This resolves the localStorage dependency and enables wallet-based discovery.

---

## Frontend

- **Vite** — build tooling, static output for GitHub Pages
- **Svelte** — UI framework; chosen for shallow learning curve and compiled output with no runtime framework overhead
- **ethers.js** — wallet connection and contract interaction
- No React. No Next.js. No SSR.

The UI is intentionally a thin layer over the contracts. Its job is wallet connection, contract calls, and presenting state. Business logic lives in the contracts.

---

## Address Generation

**Do not generate, guess, or hallucinate Ethereum addresses in code.** For security reasons:
- Placeholder addresses create false sense of security if they slip into production
- Hard-coded addresses should only appear for externally verified constants (e.g. USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — this one is confirmed)
- For any address that needs to be provided by the user or environment (e.g. withdrawal address, factory address), use placeholders or TODO comments instead

Example:
```solidity
// ❌ Don't do this:
address withdrawalAddress = 0x1234567890123456789012345678901234567890;

// ✅ Do this:
// TODO: Set withdrawal address — address goes here
address withdrawalAddress; // Set via setWithdrawalAddress()
```

---

## Extensibility Principles

> Only introduce complexity when it meaningfully increases usability or security.

- The contracts are designed to be extended, not forked and rewritten
- The UI is one possible frontend — others should be able to build against the same contracts
- The automation server has documented interfaces so others can implement their own
- No component should depend on infrastructure controlled by this project's maintainer
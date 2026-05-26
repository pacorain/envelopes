# Envelope — On-Chain Envelope Budgeting

A decentralized envelope budgeting system built on EVM-compatible blockchains. Inspired by the classic cash envelope method, this dApp lets you organize funds into named envelopes, route deposits across them, and enforce strict withdrawal rules through smart contracts.

Fully open-source. No backend required. Deployable as a static site.

> [!CAUTION]
> **In development**
> This project is a work in progress. It has not been audited, and code may change. Any deployed artifacts should be considered experimental, and can lead to loss of funds. Use at your own risk.

> **Personal Project**  
> This is an independent, personal project. It is not affiliated with, endorsed by, or developed as part of any employer relationship.

---

## Concept

The envelope method is simple: when money comes in, you divide it across named buckets (envelopes) before you need it — groceries, rent, travel, etc. Spending only happens from the relevant envelope.

This project brings that model on-chain, with:

- **Portfolios** — a smart contract that manages access control and orchestrates fund movement
- **Envelopes** — individual contracts with their own addresses, each holding a named allocation
- **Unallocated balance** — funds deposited to the portfolio but not yet routed to an envelope
- **Role-based access** — different wallets have different capabilities
- **A withdrawal address** — the only sanctioned path for funds to leave the portfolio

Envelopes are first-class on-chain objects. Because each envelope is a real contract address, funds can be deposited directly to a specific envelope without going through the portfolio UI first. Envelope addresses can also be inspected with standard on-chain tooling.

The primary token is **USDC** (ERC-20). Native ETH is not a design target.

---

## Roles

Access control is modeled around **key security tiers**, not user accounts. The same person may hold both roles using different wallet types.

### Admin (Owner)
- Full control over the portfolio
- Can add and remove manager wallets
- **Is the only role that can set or change the withdrawal address**
- Can withdraw funds to the withdrawal address
- Can deploy new portfolios (v1: manually; v2: via factory contract)

### Manager
- Day-to-day operational access
- Can create and rename envelopes
- Can move funds between envelopes within the portfolio
- Can send funds to the withdrawal address
- **Cannot send funds to any arbitrary address**
- **Cannot change the withdrawal address**

### Security Model

A compromised manager wallet (e.g. a hot wallet or mobile wallet) cannot drain funds to an attacker-controlled address. The worst-case outcome of a manager compromise is funds routed to the pre-approved withdrawal address, which the admin controls. This makes the manager role safe to delegate to less-secure signers.

---

## Smart Contracts

> Built for EVM-compatible networks. Targeting Base for deployment.
> Written in Solidity. OpenZeppelin libraries used where appropriate.

### Architecture

The system is composed of two contract types per portfolio: one `Portfolio` and one `Envelope` per named allocation.

**Design principle: Envelope as dumb vault, Portfolio as sole authorized caller.**

Envelope contracts hold funds and expose transfer functions, but all authorization logic lives in the Portfolio. Envelope functions are only callable by the Portfolio contract address that deployed them. This means there is exactly one place to audit for permission logic.

The Portfolio is the entry point for all operations. It verifies the caller's role, determines what is permitted, and calls the relevant Envelope contract(s) to move funds. No wallet interacts with an Envelope directly.

### `Portfolio.sol`

The core contract. One deployment = one portfolio. Deployed with an admin address and a token address (e.g. USDC).

**State**

| Field | Type | Description |
|---|---|---|
| `admin` | `address` | The owner wallet |
| `withdrawalAddress` | `address` | The only permitted external destination for funds |
| `token` | `IERC20` | The ERC-20 token this portfolio manages (e.g. USDC) |
| `managers` | `mapping(address => bool)` | Approved manager wallets |
| `envelopes` | `mapping(bytes32 => address)` | Maps envelope name to its contract address |
| `envelopeList` | `bytes32[]` | Ordered list of envelope identifiers |
| `unallocated` | `uint256` | Funds deposited to the portfolio but not yet routed to an envelope |

The `unallocated` balance represents the inbox — money that has arrived but not been divided. This is the balance the allocation UI operates on.

**Key Functions**

| Function | Role | Description |
|---|---|---|
| `deposit(amount)` | Anyone | Pull USDC from caller into the portfolio's unallocated balance |
| `allocate(name, amount)` | Manager+ | Move funds from unallocated into a named envelope |
| `move(from, to, amount)` | Manager+ | Move funds between two envelopes |
| `sendToWithdrawal(envelope, amount)` | Manager+ | Send funds from an envelope to the withdrawal address |
| `withdraw(amount)` | Admin | Send unallocated funds to the withdrawal address |
| `setWithdrawalAddress(addr)` | Admin | Change the withdrawal address |
| `addManager(addr)` | Admin | Grant manager role to a wallet |
| `removeManager(addr)` | Admin | Revoke manager role |
| `createEnvelope(name)` | Manager+ | Deploy a new `Envelope` contract and register it |

### `Envelope.sol`

A minimal vault contract. One deployment per named envelope, created by the Portfolio.

**State**

| Field | Type | Description |
|---|---|---|
| `portfolio` | `address` | The Portfolio contract that deployed this envelope — the only authorized caller |
| `token` | `IERC20` | The ERC-20 token this envelope holds |
| `name` | `bytes32` | The envelope's identifier |

**Key Functions**

| Function | Callable By | Description |
|---|---|---|
| `transfer(to, amount)` | Portfolio only | Move funds to another address (envelope or withdrawal) |
| `balance()` | Anyone | Return current token balance of this envelope |

Because each `Envelope` is a real contract with its own address, USDC can be sent directly to that address by anyone — a payroll provider, a recurring transfer, another contract. The Portfolio does not need to be involved in deposits to individual envelopes. The Portfolio's `unallocated` balance exists separately for funds deposited at the portfolio level.

### Future: `PortfolioFactory.sol` _(v2)_

A factory contract that deploys `Portfolio` instances and maintains a registry. Allows any wallet to create a portfolio from the UI without touching deployment infrastructure. Enables the UI to discover all portfolios associated with a connected wallet.

---

## Stack

### Smart Contracts
- **Solidity** — contract language
- **OpenZeppelin** — access control primitives, security utilities
- **Hardhat** — local development, testing, deployment scripting
- **ethers.js** — contract interaction in the frontend

### Frontend
- **Vite** — build tooling, local dev server, static output
- **Svelte** — UI framework (compiles to vanilla JS, minimal runtime overhead)
- **ethers.js** — wallet connection, contract calls
- **Static hosting** — GitHub Pages or equivalent; no server required

### Why Svelte?
React is the default choice for dApp frontends, but it carries significant onboarding overhead and runtime complexity. Svelte compiles components down to plain JavaScript — no virtual DOM, no framework shipped to the user. Its reactive model (especially for things like linked allocation sliders that must sum to 100%) is more intuitive and requires far less boilerplate.

---

## Deployment

### v1 (Current)

Portfolios are deployed directly from the UI:

1. Connect your admin wallet
2. Click **Create Portfolio** — the UI deploys `Portfolio.sol` with your wallet as admin
3. The contract address is saved to browser `localStorage`
4. On return visits, the app reconnects to your existing portfolio

**v1 Limitations:**
- No on-chain registry — your portfolio address is stored in `localStorage` only
- Switching browsers or clearing storage requires manually re-entering the contract address
- No UI-based discovery of portfolios by wallet address
- These limitations are resolved in v2 with the factory + registry pattern

### v2 (Planned)

- `PortfolioFactory.sol` deployed once to the target network
- Factory address baked into the UI as a config constant
- UI queries the factory to discover all portfolios for a connected wallet
- No localStorage dependency

---

## Automation (Optional Server Component)

The smart contract layer is designed to work without any server component — all fund management can be done manually through the UI. However, an optional automation layer can be introduced to enable rule-based routing, transaction monitoring, and external integrations.

An automation server is granted the **manager role** on a portfolio, just like any other manager wallet. It operates entirely within the same permission constraints: it can move funds between envelopes and send to the withdrawal address, but cannot change the withdrawal address or exceed its role. It holds no special trust at the contract level. If the server is compromised or behaves incorrectly, the admin can revoke its manager role.

### Intended Capabilities

**Transaction monitoring**
- Poll or webhook-subscribe to incoming transactions on portfolio and envelope addresses
- Read Coinbase Debit Card / Coinbase One Card transactions via the Coinbase API
- Detect direct deposits (e.g. payroll) arriving at the portfolio or a specific envelope

**Rule-based routing**
- Define rules that map transaction types, merchants, or amounts to specific envelopes
- Automatically allocate a deposit across envelopes according to a saved split (e.g. 30% rent, 20% groceries)
- Categorize card spend and deduct from the corresponding envelope balance

**Coinbase integration (planned)**
- Read card transactions and direct deposit activity via Coinbase API
- Trigger `sendToWithdrawal()` via the Coinbase Send API to move funds out of the portfolio to an exchange or external address

### Design Principles

- **Self-hostable** — the server should be straightforward to run locally or on a simple VPS. No proprietary infrastructure required.
- **Open interfaces** — routing rules and integrations should be defined via a documented interface so others can implement their own automation backends
- **Stateless where possible** — the source of truth is always the chain. The server should be resumable from a cold start by reading contract state.
- **Auditable actions** — every action the server takes should be a traceable on-chain transaction, not a side-effect hidden in a database

---

## Philosophy

> Only introduce complexity when it meaningfully increases usability or security.

This project aims to stay auditable, forkable, and self-hostable. The intended extension points are:

- **Alternative UIs** — anyone can build a different frontend against the same contracts
- **Server components** — an optional automation layer (e.g. scheduled transfers, rule-based routing) can be given a manager role and operate within the same permission constraints as any other manager wallet. It holds no special trust.
- **Contract extensions** — the base `Portfolio.sol` is designed to be extended, not replaced

---

## Is This Safe?

**This project has not been audited.** See the caution notice at the top of this file.

The contracts are designed with a clear security model:

- A compromised **manager** wallet cannot drain funds to an attacker — it can only route funds to the pre-set withdrawal address.
- A compromised **admin** key can result in full loss of funds. Use a hardware wallet or multisig for the admin role.
- Funds can only leave the portfolio to one pre-approved address (the withdrawal address), set exclusively by the admin.

For a full breakdown of what the system defends against, what it does not, and the assumptions it makes, see [THREAT_MODEL.md](THREAT_MODEL.md).

---

## License

All code is open-source under the MIT License. See [LICENSE](LICENSE) for details.
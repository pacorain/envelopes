# Frontend Plan — v1

This document describes the plan for building the v1 frontend. It is a reference for future implementation work; nothing here is built yet.

## Context

The project has a boilerplate Svelte + Vite frontend that needs to be replaced with actual application UI. The contracts are partially implemented (`Envelope.sol` is complete; `Portfolio.sol` is a stub with a documented interface in the README). The frontend needs to expose the full contract interface across three pages: a portfolio dashboard, an admin management panel, and a settings page for browser-persisted configuration.

The goal for v1 is a practical, minimal UI — no UI library, no router library, no extra dependencies beyond what's already in `frontend/package.json` (`svelte`, `vite`, `ethers`).

---

## Pages

### 1. Portfolio (default, `#/`)
Main operational view for day-to-day use.

- **Header bar**: unallocated balance + Deposit button + Withdraw button (Manager+, sends unallocated funds to the withdrawal address)
- **Envelope grid**: one card per envelope showing name, balance, and action buttons
  - Allocate (move from unallocated → this envelope)
  - Move (move from this → another envelope)
  - Send to Withdrawal
- **"+ New Envelope"** button (Manager+)
- **Empty state**: if no portfolio is connected, show a Setup panel (deploy new or enter existing address)

### 2. Admin (`#/admin`)
Admin-only management. Non-admins see a "not authorized" message.

- Current admin address + **Transfer Admin** action (input new address)
- Current withdrawal address + **Change Withdrawal Address** action
- Managers list + **Add Manager** / **Remove Manager** actions

### 3. Settings (`#/settings`)
Persisted in `localStorage`. No wallet needed.

- Portfolio contract address (text input + Save)
- Token address (text input, default: USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- "Deploy new portfolio" button (requires wallet, deploys `Portfolio.sol`)

---

## File Structure

```
frontend/src/
├── App.svelte                  # Nav + hash-based routing (currentPage reactive var)
├── app.css                     # Repurpose existing design tokens; clear boilerplate layout
├── main.js                     # Unchanged
└── lib/
    ├── stores/
    │   ├── wallet.js           # provider, signer, account (writable Svelte stores)
    │   └── portfolio.js        # portfolioContract, isAdmin, isManager, unallocated, envelopes[]
    ├── abi/
    │   ├── Portfolio.js        # Portfolio ABI (based on documented interface)
    │   └── Envelope.js         # Envelope ABI (for balance() reads)
    ├── pages/
    │   ├── Portfolio.svelte    # Dashboard + operations
    │   ├── Admin.svelte        # Admin management
    │   └── Settings.svelte     # localStorage settings + deploy flow
    └── components/
        ├── Nav.svelte          # Top nav: page links + WalletConnect
        ├── WalletConnect.svelte # Connect/disconnect button + address chip
        ├── EnvelopeCard.svelte # Envelope name, balance, action buttons
        ├── ActionForm.svelte   # Reusable form (label, amount input, address input, submit)
        └── TxButton.svelte     # Button with pending/success/error transaction states
```

---

## State Management

**`lib/stores/wallet.js`** — Svelte writable stores:

```js
export const provider = writable(null);   // ethers.BrowserProvider
export const signer = writable(null);
export const account = writable(null);    // connected address string
```

`connectWallet()` calls `window.ethereum`, creates a `BrowserProvider`, and sets the stores.

**`lib/stores/portfolio.js`** — derived + writable stores:

```js
export const portfolioAddress = writable(localStorage.getItem('envelope.portfolioAddress'));
export const portfolioContract = derived([signer, portfolioAddress], ...);
export const isAdmin = writable(false);
export const isManager = writable(false);
export const unallocated = writable(0n);
export const envelopes = writable([]);    // [{name: string, address: string, balance: bigint}]
```

`refreshState()` reads contract state: calls `admin()`, `isManager(account)`, `unallocated()`, `envelopeList()`, then for each envelope calls `balance()` on the Envelope contract.

---

## localStorage Keys

- `envelope.portfolioAddress` — portfolio contract address
- `envelope.tokenAddress` — ERC-20 token address (default: USDC on Base)

---

## ABI Design

Portfolio ABI covers the documented interface from `README.md`:

- `admin()` → address
- `withdrawalAddress()` → address
- `token()` → address
- `unallocated()` → uint256
- `envelopeList()` → bytes32[]
- `envelopes(bytes32)` → address
- `isManager(address)` → bool (needed for role detection)
- `deposit(uint256)`
- `allocate(bytes32, uint256)`
- `move(bytes32, bytes32, uint256)`
- `sendToWithdrawal(bytes32, uint256)`
- `withdraw(uint256)` (Manager+: send unallocated funds to withdrawal address)
- `setWithdrawalAddress(address)`
- `addManager(address)`
- `removeManager(address)`
- `createEnvelope(bytes32)`
- `transferAdmin(address)` (implied by "transfer admin privileges")

Envelope ABI only needs:

- `balance()` → uint256
- `name()` → bytes32

> `Portfolio.sol` is currently a stub. The ABI is written against the documented interface and will need validation when the contract is implemented. Note that `withdraw()` must accept Manager+ callers (not just admin) to match this plan — this is a deviation from the current README table and should be reconciled when the contract is written.

---

## Key Implementation Details

- **Routing**: No router library. `App.svelte` reads `window.location.hash` and sets a `currentPage` variable. Nav links update the hash. Svelte `{#if}` blocks render the correct page.
- **Token decimals**: USDC has 6 decimals. Format amounts with `ethers.formatUnits(amount, 6)` for display and `ethers.parseUnits(input, 6)` for contract calls.
- **bytes32 names**: Use `ethers.encodeBytes32String(name)` when calling `createEnvelope()` / `allocate()` / etc., and `ethers.decodeBytes32String(bytes32)` for display.
- **ERC-20 approval**: `deposit()` requires the user's wallet to approve the Portfolio contract to spend USDC first. The deposit flow checks allowance and calls `approve()` if needed before `deposit()`.
- **TxButton states**: pending (spinner), success (checkmark + tx hash link), error (message). Reset after timeout.
- **Role detection**: After wallet connect and portfolio load, call `admin()` and `isManager(account)` to set `isAdmin` and `isManager` stores. These gate UI elements.
- **Deploy new portfolio**: In Settings, a "Deploy Portfolio" button deploys `Portfolio.sol` bytecode inline using `ethers.ContractFactory`. Saves resulting address to `localStorage`.

---

## Out of Scope (for v1)

- Multi-portfolio switching (v2 feature)
- Factory/registry pattern (v2)
- Automation server UI
- Mobile-responsive layout (basic responsiveness only)
- Any UI library (no shadcn, no Bootstrap, etc.)

---

## Verification

1. `npm run frontend:dev` — dev server starts, page loads without errors
2. Connect MetaMask (or equivalent) → account address appears in nav
3. Enter a deployed Portfolio address in Settings → saved to `localStorage`
4. Portfolio page loads: unallocated balance and envelope list render
5. Create envelope → tx sent → envelope appears in list
6. Allocate funds → tx sent → envelope balance updates
7. Admin page: non-admin sees "not authorized"; admin sees management forms
8. Transfer admin, change withdrawal address, add/remove manager — all send txs and reflect updated state

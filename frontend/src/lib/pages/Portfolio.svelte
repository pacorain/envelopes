<script>
  import { ethers } from 'ethers';
  import { portfolio, formatAmount, parseAmount } from '../stores/portfolio.svelte.js';
  import { wallet } from '../stores/wallet.svelte.js';
  import { ERC20ABI } from '../abi/Portfolio.js';
  import TxButton from '../components/TxButton.svelte';

  // Deposit form
  let depositAmount = $state('');

  // Create envelope form
  let newEnvName = $state('');

  // Allocate form: keyed by envelope index
  let allocateAmounts = $state({});

  // Withdraw from envelope form
  let withdrawAmounts = $state({});

  // Move funds: simple modal state
  let moveFrom = $state(null);
  let moveTo = $state('');
  let moveAmount = $state('');

  $effect(() => {
    if (wallet.connected && portfolio.address) {
      portfolio.refresh();
    }
  });

  async function deposit() {
    const amount = parseAmount(depositAmount);
    // Ensure approval first
    const tokenContract = new ethers.Contract(
      portfolio.tokenAddress,
      ERC20ABI,
      wallet.signer,
    );
    const allowance = await tokenContract.allowance(wallet.account, portfolio.address);
    if (allowance < amount) {
      const approveTx = await tokenContract.approve(portfolio.address, amount);
      await approveTx.wait();
    }
    return portfolio.contract.connect(wallet.signer).deposit(amount);
  }

  async function createEnvelope() {
    const name = ethers.encodeBytes32String(newEnvName.trim());
    return portfolio.contract.connect(wallet.signer).createEnvelope(name);
  }

  async function allocate(index) {
    const amount = parseAmount(allocateAmounts[index] ?? '0');
    return portfolio.contract.connect(wallet.signer).allocate(index, amount);
  }

  async function withdrawFromEnvelope(index) {
    const amount = parseAmount(withdrawAmounts[index] ?? '0');
    return portfolio.contract.connect(wallet.signer).withdrawFromEnvelope(index, amount);
  }

  async function withdrawUnallocated() {
    return portfolio.contract.connect(wallet.signer).withdrawUnallocated(portfolio.unallocated);
  }

  async function moveFunds() {
    const from = moveFrom;
    const to = Number(moveTo);
    const amount = parseAmount(moveAmount);
    return portfolio.contract.connect(wallet.signer).moveFunds(from, to, amount);
  }
</script>

<div class="page">
  {#if !portfolio.address}
    <div class="empty-state">
      <h2>No portfolio connected</h2>
      <p>Go to <a href="#/settings">Settings</a> to enter or deploy a Portfolio contract address.</p>
    </div>
  {:else if !wallet.connected}
    <div class="empty-state">
      <h2>Wallet not connected</h2>
      <p>Connect your wallet using the button in the top right to view and manage your portfolio.</p>
    </div>
  {:else if portfolio.loading}
    <div class="loading">Loading portfolio…</div>
  {:else if portfolio.error}
    <div class="error-banner">{portfolio.error}</div>
  {:else}
    <!-- Header: unallocated balance -->
    <div class="header-bar">
      <div class="balance-block">
        <span class="label">Unallocated</span>
        <span class="amount">{formatAmount(portfolio.unallocated)} USDC</span>
      </div>

      {#if portfolio.isManager}
        <div class="header-actions">
          <!-- Deposit -->
          <div class="inline-form">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              bind:value={depositAmount}
            />
            <TxButton
              label="Deposit"
              action={deposit}
              disabled={!depositAmount || Number(depositAmount) <= 0}
              onSuccess={() => { depositAmount = ''; portfolio.refresh(); }}
            />
          </div>

          <!-- Withdraw unallocated (admin only) -->
          {#if portfolio.isAdmin && portfolio.unallocated > 0n}
            <TxButton
              label="Withdraw Unallocated"
              action={withdrawUnallocated}
              onSuccess={() => portfolio.refresh()}
            />
          {/if}
        </div>
      {/if}
    </div>

    <!-- Envelope grid -->
    <div class="envelope-grid">
      {#each portfolio.envelopes as env (env.index)}
        <div class="envelope-card">
          <div class="env-header">
            <h3 class="env-name">{env.name}</h3>
            <span class="env-balance">{formatAmount(env.balance)} USDC</span>
          </div>
          <p class="env-address">{env.address.slice(0, 10)}…{env.address.slice(-6)}</p>

          {#if portfolio.isManager}
            <div class="env-actions">
              <div class="inline-form">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Allocate"
                  bind:value={allocateAmounts[env.index]}
                />
                <TxButton
                  label="Allocate"
                  action={() => allocate(env.index)}
                  disabled={!allocateAmounts[env.index] || Number(allocateAmounts[env.index]) <= 0}
                  onSuccess={() => { allocateAmounts[env.index] = ''; portfolio.refresh(); }}
                />
              </div>

              <div class="inline-form">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Withdraw"
                  bind:value={withdrawAmounts[env.index]}
                />
                <TxButton
                  label="Send to Withdrawal"
                  action={() => withdrawFromEnvelope(env.index)}
                  disabled={!withdrawAmounts[env.index] || Number(withdrawAmounts[env.index]) <= 0}
                  onSuccess={() => { withdrawAmounts[env.index] = ''; portfolio.refresh(); }}
                />
              </div>

              <!-- Move funds trigger -->
              <button
                class="secondary"
                onclick={() => { moveFrom = env.index; moveTo = ''; moveAmount = ''; }}
              >Move Funds →</button>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Create envelope card (manager only) -->
      {#if portfolio.isManager}
        <div class="envelope-card new-envelope">
          <h3>New Envelope</h3>
          <div class="inline-form stacked">
            <input
              type="text"
              placeholder="Name (e.g. Rent)"
              bind:value={newEnvName}
              maxlength="31"
            />
            <TxButton
              label="+ Create Envelope"
              action={createEnvelope}
              disabled={!newEnvName.trim()}
              onSuccess={() => { newEnvName = ''; portfolio.refresh(); }}
            />
          </div>
        </div>
      {/if}

      {#if portfolio.envelopes.length === 0 && !portfolio.isManager}
        <p class="empty-hint">No envelopes yet. A manager must create them.</p>
      {/if}
    </div>

    <!-- Move funds modal -->
    {#if moveFrom !== null}
      <div class="modal-backdrop" onclick={() => moveFrom = null} role="presentation"></div>
      <div class="modal">
        <h3>Move Funds from envelope #{moveFrom}</h3>
        <label>
          Destination envelope index
          <input type="number" min="0" bind:value={moveTo} placeholder="e.g. 1" />
        </label>
        <label>
          Amount
          <input type="number" min="0" step="0.01" bind:value={moveAmount} placeholder="0.00" />
        </label>
        <div class="modal-actions">
          <TxButton
            label="Move"
            action={moveFunds}
            disabled={moveTo === '' || !moveAmount || Number(moveAmount) <= 0}
            onSuccess={() => { moveFrom = null; portfolio.refresh(); }}
          />
          <button class="secondary" onclick={() => moveFrom = null}>Cancel</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
    position: relative;
  }

  .empty-state, .loading {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--text-secondary);
  }

  .empty-state h2 {
    margin-bottom: 0.5rem;
  }

  .empty-state a {
    color: var(--accent);
  }

  .error-banner {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .header-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .balance-block {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 140px;
  }

  .label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .amount {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-left: auto;
  }

  .envelope-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .envelope-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .envelope-card.new-envelope {
    border-style: dashed;
    background: transparent;
  }

  .envelope-card.new-envelope h3 {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .env-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.25rem;
  }

  .env-name {
    font-size: 1rem;
    margin: 0;
  }

  .env-balance {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--accent);
  }

  .env-address {
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--text-muted);
    margin: 0 0 0.75rem;
  }

  .env-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .inline-form {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .inline-form.stacked {
    flex-direction: column;
    align-items: stretch;
  }

  .inline-form input {
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .inline-form input:focus {
    outline: none;
    border-color: var(--accent);
  }

  button.secondary {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--text-secondary);
  }

  button.secondary:hover {
    background: var(--border);
  }

  .empty-hint {
    color: var(--text-muted);
    font-size: 0.9rem;
    grid-column: 1 / -1;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 11;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    width: 320px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }

  .modal h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }

  .modal label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  .modal input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>

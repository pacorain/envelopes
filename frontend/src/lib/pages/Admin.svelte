<script>
  import { portfolio } from '../stores/portfolio.svelte.js';
  import { wallet } from '../stores/wallet.svelte.js';
  import TxButton from '../components/TxButton.svelte';

  let newWithdrawalAddr = $state('');
  let proposeAdminAddr = $state('');
  let addManagerAddr = $state('');
  let removeManagerAddr = $state('');

  $effect(() => {
    if (wallet.connected && portfolio.address) {
      portfolio.refresh();
    }
  });

  async function setWithdrawalAddress() {
    return portfolio.contract.connect(wallet.signer).setWithdrawalAddress(newWithdrawalAddr.trim());
  }

  async function proposeAdmin() {
    return portfolio.contract.connect(wallet.signer).proposeAdmin(proposeAdminAddr.trim());
  }

  async function cancelPendingAdmin() {
    return portfolio.contract.connect(wallet.signer).cancelPendingAdmin();
  }

  async function acceptAdmin() {
    return portfolio.contract.connect(wallet.signer).acceptAdmin();
  }

  async function addManager() {
    return portfolio.contract.connect(wallet.signer).addManager(addManagerAddr.trim());
  }

  async function removeManager() {
    return portfolio.contract.connect(wallet.signer).removeManager(removeManagerAddr.trim());
  }

  function isValidAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
  }
</script>

<div class="page">
  <h1>Admin</h1>

  {#if !portfolio.address}
    <div class="empty-state">
      <p>No portfolio connected. Go to <a href="#/settings">Settings</a>.</p>
    </div>
  {:else if !wallet.connected}
    <div class="empty-state">
      <p>Connect your wallet to manage the portfolio.</p>
    </div>
  {:else if portfolio.loading}
    <div class="loading">Loading…</div>
  {:else if portfolio.error}
    <div class="error-banner">{portfolio.error}</div>
  {:else if !portfolio.isAdmin}
    <div class="not-authorized">
      <h2>Not authorized</h2>
      <p>Only the admin can access this page.</p>
      <p>Connected: <code>{wallet.account}</code></p>
      <p>Admin: <code>{portfolio.admin}</code></p>

      <!-- Show acceptAdmin if this address is the pending admin -->
      {#if portfolio.pendingAdmin?.toLowerCase() === wallet.account?.toLowerCase()}
        <div class="accept-block">
          <p>You have been proposed as the new admin.</p>
          <TxButton
            label="Accept Admin Role"
            action={acceptAdmin}
            onSuccess={() => portfolio.refresh()}
          />
        </div>
      {/if}
    </div>
  {:else}
    <!-- Admin view -->
    <div class="grid">

      <!-- Admin transfer -->
      <section class="card">
        <h2>Admin Transfer</h2>
        <div class="info-row">
          <span class="key">Current admin</span>
          <code>{portfolio.admin}</code>
        </div>
        {#if portfolio.pendingAdmin}
          <div class="info-row pending">
            <span class="key">Pending admin</span>
            <code>{portfolio.pendingAdmin}</code>
          </div>
          <div class="actions">
            <TxButton
              label="Cancel Proposal"
              action={cancelPendingAdmin}
              onSuccess={() => portfolio.refresh()}
            />
          </div>
        {:else}
          <label>
            Propose new admin
            <input
              type="text"
              placeholder="0x…"
              bind:value={proposeAdminAddr}
              spellcheck="false"
            />
          </label>
          <div class="actions">
            <TxButton
              label="Propose"
              action={proposeAdmin}
              disabled={!isValidAddress(proposeAdminAddr)}
              onSuccess={() => { proposeAdminAddr = ''; portfolio.refresh(); }}
            />
          </div>
        {/if}
      </section>

      <!-- Withdrawal address -->
      <section class="card">
        <h2>Withdrawal Address</h2>
        <div class="info-row">
          <span class="key">Current</span>
          <code>{portfolio.withdrawalAddress}</code>
        </div>
        <label>
          New address
          <input
            type="text"
            placeholder="0x…"
            bind:value={newWithdrawalAddr}
            spellcheck="false"
          />
        </label>
        <div class="actions">
          <TxButton
            label="Update"
            action={setWithdrawalAddress}
            disabled={!isValidAddress(newWithdrawalAddr)}
            onSuccess={() => { newWithdrawalAddr = ''; portfolio.refresh(); }}
          />
        </div>
      </section>

      <!-- Manager management -->
      <section class="card">
        <h2>Managers</h2>

        <label>
          Add manager
          <input
            type="text"
            placeholder="0x…"
            bind:value={addManagerAddr}
            spellcheck="false"
          />
        </label>
        <div class="actions">
          <TxButton
            label="Add Manager"
            action={addManager}
            disabled={!isValidAddress(addManagerAddr)}
            onSuccess={() => { addManagerAddr = ''; portfolio.refresh(); }}
          />
        </div>

        <hr />

        <label>
          Remove manager
          <input
            type="text"
            placeholder="0x…"
            bind:value={removeManagerAddr}
            spellcheck="false"
          />
        </label>
        <div class="actions">
          <TxButton
            label="Remove Manager"
            action={removeManager}
            disabled={!isValidAddress(removeManagerAddr)}
            onSuccess={() => { removeManagerAddr = ''; portfolio.refresh(); }}
          />
        </div>

        <p class="hint">
          Note: The admin is always an implicit manager. The manager list shows addresses explicitly granted the role.
        </p>
      </section>

    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .empty-state, .loading, .not-authorized {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--text-secondary);
  }

  .empty-state a {
    color: var(--accent);
  }

  .not-authorized h2 {
    margin-bottom: 0.5rem;
  }

  .not-authorized code {
    font-size: 0.85rem;
  }

  .accept-block {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .error-banner {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    font-size: 0.9rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    align-items: start;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  h2 {
    font-size: 0.95rem;
    margin: 0 0 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .info-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  .info-row.pending code {
    color: var(--warning);
  }

  .key {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  code {
    font-family: monospace;
    font-size: 0.8rem;
    word-break: break-all;
    color: var(--text-primary);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  input[type="text"] {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.45rem 0.7rem;
    font-family: monospace;
    font-size: 0.82rem;
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--accent);
  }

  .actions {
    margin-top: 0.25rem;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1rem 0;
  }

  .hint {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-top: 0.75rem;
  }
</style>

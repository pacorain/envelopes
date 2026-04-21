<script>
  import { isAddress } from 'ethers';
  import {
    portfolioContract,
    isAdmin,
    adminAddress,
    withdrawalAddress,
    managers,
    loading,
    loadError,
  } from '../stores/portfolio.js';
  import { account } from '../stores/wallet.js';
  import { portfolioAddress } from '../stores/settings.js';
  import TxButton from '../components/TxButton.svelte';

  let newAdmin = $state('');
  let newWithdrawal = $state('');
  let newManager = $state('');

  function validAddr(addr) {
    return typeof addr === 'string' && isAddress(addr.trim());
  }

  async function transferAdmin() {
    return $portfolioContract.transferAdmin(newAdmin.trim());
  }
  async function setWithdrawal() {
    return $portfolioContract.setWithdrawalAddress(newWithdrawal.trim());
  }
  async function addManager() {
    return $portfolioContract.addManager(newManager.trim());
  }
  function removeManager(addr) {
    return () => $portfolioContract.removeManager(addr);
  }
</script>

<section class="page">
  <header>
    <h1>Admin</h1>
    <p>Privileged operations. Only the portfolio admin can use this page.</p>
  </header>

  {#if !$portfolioAddress}
    <div class="notice">
      No portfolio configured. Set an address in <a href="#/settings">Settings</a> first.
    </div>
  {:else if !$account}
    <div class="notice">Connect your wallet to continue.</div>
  {:else if $loading}
    <div class="notice">Loading…</div>
  {:else if $loadError}
    <div class="notice err">Failed to load portfolio state: {$loadError}</div>
  {:else if !$isAdmin}
    <div class="notice err">
      Not authorized. Your connected wallet is not the admin of this portfolio.
      {#if $adminAddress}
        <div class="hint">Admin: <code>{$adminAddress}</code></div>
      {/if}
    </div>
  {:else}
    <div class="group">
      <h2>Admin</h2>
      <p class="hint">Current admin: <code>{$adminAddress}</code></p>
      <div class="row">
        <input
          type="text"
          placeholder="New admin address (0x…)"
          bind:value={newAdmin}
          spellcheck="false"
        />
        <TxButton
          label="Transfer Admin"
          action={transferAdmin}
          disabled={!validAddr(newAdmin)}
          onSuccess={() => (newAdmin = '')}
          variant="danger"
        />
      </div>
      <p class="warn">
        Transferring admin is irreversible from this UI. Double-check the address.
      </p>
    </div>

    <div class="group">
      <h2>Withdrawal Address</h2>
      <p class="hint">
        Current: {#if $withdrawalAddress}<code>{$withdrawalAddress}</code>{:else}<em>not set</em>{/if}
      </p>
      <div class="row">
        <input
          type="text"
          placeholder="New withdrawal address (0x…)"
          bind:value={newWithdrawal}
          spellcheck="false"
        />
        <TxButton
          label="Update"
          action={setWithdrawal}
          disabled={!validAddr(newWithdrawal)}
          onSuccess={() => (newWithdrawal = '')}
        />
      </div>
    </div>

    <div class="group">
      <h2>Managers</h2>
      <p class="hint">Wallets with operational access (create envelopes, move funds, send to withdrawal).</p>
      <div class="row">
        <input
          type="text"
          placeholder="New manager address (0x…)"
          bind:value={newManager}
          spellcheck="false"
        />
        <TxButton
          label="Add Manager"
          action={addManager}
          disabled={!validAddr(newManager)}
          onSuccess={() => (newManager = '')}
        />
      </div>

      {#if $managers.length === 0}
        <div class="empty">No managers configured.</div>
      {:else}
        <ul class="managers">
          {#each $managers as mgr}
            <li>
              <code>{mgr}</code>
              <TxButton label="Remove" action={removeManager(mgr)} variant="danger" />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: 32px 24px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  h1 {
    font-size: 32px;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 4px;
  }
  header p {
    margin: 0;
    color: var(--text);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
  }
  .hint {
    font-size: 14px;
    color: var(--text);
    margin: 0;
  }
  .warn {
    font-size: 13px;
    color: #c0392b;
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  input[type='text'] {
    font: inherit;
    font-family: var(--mono);
    font-size: 14px;
    flex: 1;
    min-width: 280px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text-h);
  }
  .notice {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--code-bg);
    color: var(--text);
  }
  .notice.err {
    border-color: #c0392b;
    color: #c0392b;
    background: rgba(192, 57, 43, 0.08);
  }
  .managers {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .managers li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .empty {
    font-size: 14px;
    color: var(--text);
    font-style: italic;
    margin-top: 4px;
  }
</style>

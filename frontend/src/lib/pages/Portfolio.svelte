<script>
  import { Contract, formatUnits, parseUnits, encodeBytes32String, MaxUint256 } from 'ethers';
  import {
    portfolioContract,
    envelopes,
    unallocated,
    tokenInfo,
    isManager,
    loading,
    loadError,
  } from '../stores/portfolio.js';
  import { account, signer } from '../stores/wallet.js';
  import { portfolioAddress } from '../stores/settings.js';
  import { ERC20ABI } from '../abi/ERC20.js';
  import EnvelopeCard from '../components/EnvelopeCard.svelte';
  import TxButton from '../components/TxButton.svelte';
  import AmountInput from '../components/AmountInput.svelte';

  let openForm = $state(null); // 'deposit' | 'withdraw' | 'allocate' | 'create' | null
  let depositAmount = $state('');
  let withdrawAmount = $state('');
  let allocateAmount = $state('');
  let allocateTarget = $state('');
  let newEnvelopeName = $state('');

  function display(bal) {
    return formatUnits(bal, $tokenInfo.decimals);
  }

  function close() {
    openForm = null;
    depositAmount = '';
    withdrawAmount = '';
    allocateAmount = '';
    allocateTarget = '';
    newEnvelopeName = '';
  }

  async function deposit() {
    const amt = parseUnits(depositAmount || '0', $tokenInfo.decimals);
    const token = new Contract($tokenInfo.address, ERC20ABI, $signer);
    const allowance = await token.allowance($account, $portfolioContract.target);
    if (allowance < amt) {
      const approveTx = await token.approve($portfolioContract.target, MaxUint256);
      await approveTx.wait();
    }
    return $portfolioContract.deposit(amt);
  }

  async function withdrawUnallocated() {
    const amt = parseUnits(withdrawAmount || '0', $tokenInfo.decimals);
    return $portfolioContract.withdraw(amt);
  }

  async function allocate() {
    const amt = parseUnits(allocateAmount || '0', $tokenInfo.decimals);
    const name = encodeBytes32String(allocateTarget);
    return $portfolioContract.allocate(name, amt);
  }

  async function createEnvelope() {
    const name = encodeBytes32String(newEnvelopeName.trim());
    return $portfolioContract.createEnvelope(name);
  }

  function nameValid(name) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return false;
    try {
      encodeBytes32String(trimmed);
      return true;
    } catch {
      return false;
    }
  }
</script>

<section class="page">
  {#if !$portfolioAddress}
    <div class="setup">
      <h1>No portfolio connected</h1>
      <p>
        Open <a href="#/settings">Settings</a> to enter a deployed <code>Portfolio</code> contract
        address, or deploy a new one.
      </p>
    </div>
  {:else if !$account}
    <div class="setup">
      <h1>Connect your wallet</h1>
      <p>Use the Connect Wallet button in the top right to view and manage your portfolio.</p>
    </div>
  {:else if $loading && $envelopes.length === 0}
    <div class="setup">
      <p>Loading portfolio…</p>
    </div>
  {:else if $loadError}
    <div class="setup err">
      <h1>Could not load portfolio</h1>
      <p>{$loadError}</p>
      <p class="hint">
        Check that the portfolio address in <a href="#/settings">Settings</a> matches a deployed
        contract on the network your wallet is using.
      </p>
    </div>
  {:else}
    <header class="unallocated">
      <div>
        <div class="label">Unallocated</div>
        <div class="amount">
          <span class="num">{display($unallocated)}</span>
          <span class="sym">{$tokenInfo.symbol}</span>
        </div>
      </div>
      <div class="actions">
        {#if $isManager}
          <button type="button" onclick={() => (openForm = openForm === 'deposit' ? null : 'deposit')}>
            Deposit
          </button>
          <button type="button" onclick={() => (openForm = openForm === 'allocate' ? null : 'allocate')} disabled={$envelopes.length === 0}>
            Allocate
          </button>
          <button type="button" onclick={() => (openForm = openForm === 'withdraw' ? null : 'withdraw')}>
            Withdraw
          </button>
        {/if}
      </div>
    </header>

    {#if openForm === 'deposit'}
      <div class="form">
        <label>
          Amount to deposit
          <AmountInput bind:value={depositAmount} symbol={$tokenInfo.symbol} />
        </label>
        <div class="submit">
          <TxButton
            label="Deposit"
            action={deposit}
            disabled={!depositAmount}
            onSuccess={close}
          />
          <button type="button" class="cancel" onclick={close}>Cancel</button>
        </div>
        <p class="hint">
          Approves the portfolio to spend your {$tokenInfo.symbol} if needed, then deposits.
        </p>
      </div>
    {:else if openForm === 'allocate'}
      <div class="form">
        <label>
          Envelope
          <select bind:value={allocateTarget}>
            <option value="" disabled>Select envelope…</option>
            {#each $envelopes as env}
              <option value={env.name}>{env.name}</option>
            {/each}
          </select>
        </label>
        <label>
          Amount
          <AmountInput
            bind:value={allocateAmount}
            symbol={$tokenInfo.symbol}
            max={$unallocated}
            formatMax={display}
          />
        </label>
        <div class="submit">
          <TxButton
            label="Allocate"
            action={allocate}
            disabled={!allocateTarget || !allocateAmount}
            onSuccess={close}
          />
          <button type="button" class="cancel" onclick={close}>Cancel</button>
        </div>
      </div>
    {:else if openForm === 'withdraw'}
      <div class="form">
        <label>
          Amount (sent to withdrawal address)
          <AmountInput
            bind:value={withdrawAmount}
            symbol={$tokenInfo.symbol}
            max={$unallocated}
            formatMax={display}
          />
        </label>
        <div class="submit">
          <TxButton
            label="Withdraw"
            action={withdrawUnallocated}
            disabled={!withdrawAmount}
            onSuccess={close}
          />
          <button type="button" class="cancel" onclick={close}>Cancel</button>
        </div>
      </div>
    {/if}

    <div class="envelopes-header">
      <h2>Envelopes</h2>
      {#if $isManager}
        <button type="button" class="new" onclick={() => (openForm = openForm === 'create' ? null : 'create')}>
          + New Envelope
        </button>
      {/if}
    </div>

    {#if openForm === 'create'}
      <div class="form">
        <label>
          Envelope name (max 31 characters)
          <input type="text" bind:value={newEnvelopeName} maxlength="31" spellcheck="false" />
        </label>
        <div class="submit">
          <TxButton
            label="Create"
            action={createEnvelope}
            disabled={!nameValid(newEnvelopeName)}
            onSuccess={close}
          />
          <button type="button" class="cancel" onclick={close}>Cancel</button>
        </div>
      </div>
    {/if}

    {#if $envelopes.length === 0}
      <div class="empty">
        No envelopes yet.{#if $isManager} Create your first one above.{/if}
      </div>
    {:else}
      <div class="grid">
        {#each $envelopes as envelope (envelope.address)}
          <EnvelopeCard {envelope} />
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .page {
    max-width: 1024px;
    margin: 0 auto;
    padding: 32px 24px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .setup {
    padding: 48px 24px;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 10px;
  }
  .setup.err {
    border-color: #c0392b;
  }
  .setup h1 {
    font-size: 28px;
    margin: 0 0 12px;
  }
  .setup p {
    margin: 0 0 8px;
    color: var(--text);
  }
  .unallocated {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--code-bg);
  }
  .label {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text);
  }
  .amount {
    font-family: var(--mono);
    margin-top: 4px;
  }
  .amount .num {
    font-size: 28px;
    color: var(--text-h);
    font-weight: 500;
  }
  .amount .sym {
    font-size: 16px;
    color: var(--text);
    margin-left: 6px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .actions button {
    font: inherit;
    font-size: 14px;
    padding: 8px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-h);
    cursor: pointer;
  }
  .actions button:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px;
    border: 1px solid var(--accent-border);
    border-radius: 10px;
    background: var(--accent-bg);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: var(--text);
  }
  input[type='text'] {
    font: inherit;
    font-family: var(--mono);
    font-size: 14px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text-h);
    max-width: 320px;
  }
  select {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text-h);
    max-width: 320px;
  }
  .submit {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .cancel {
    font: inherit;
    font-size: 14px;
    background: transparent;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 8px 4px;
  }
  .hint {
    font-size: 12px;
    color: var(--text);
    margin: 0;
  }
  .envelopes-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 12px;
  }
  .envelopes-header h2 {
    font-size: 20px;
    margin: 0;
  }
  .new {
    font: inherit;
    font-size: 14px;
    padding: 6px 12px;
    border: 1px solid var(--accent-border);
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: 6px;
    cursor: pointer;
  }
  .new:hover {
    border-color: var(--accent);
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text);
    border: 1px dashed var(--border);
    border-radius: 10px;
    font-style: italic;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
</style>

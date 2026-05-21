<script>
  import { formatUnits, parseUnits, encodeBytes32String } from 'ethers';
  import { portfolioContract, envelopes, tokenInfo, isManager } from '../stores/portfolio.js';
  import TxButton from './TxButton.svelte';
  import AmountInput from './AmountInput.svelte';

  let { envelope } = $props();

  let action = $state(null); // 'move' | 'send' | null
  let amount = $state('');
  let moveTarget = $state('');

  function displayBalance(bal) {
    return formatUnits(bal, $tokenInfo.decimals);
  }

  function reset() {
    action = null;
    amount = '';
    moveTarget = '';
  }

  function otherEnvelopes() {
    return $envelopes.filter((e) => e.address !== envelope.address);
  }

  async function moveFunds() {
    const parsed = parseUnits(amount || '0', $tokenInfo.decimals);
    const toName = encodeBytes32String(moveTarget);
    return $portfolioContract.move(envelope.nameBytes32, toName, parsed);
  }

  async function sendToWithdrawal() {
    const parsed = parseUnits(amount || '0', $tokenInfo.decimals);
    return $portfolioContract.sendToWithdrawal(envelope.nameBytes32, parsed);
  }
</script>

<article class="card">
  <header>
    <h3>{envelope.name}</h3>
    <div class="bal">
      <span class="amt">{displayBalance(envelope.balance)}</span>
      <span class="sym">{$tokenInfo.symbol}</span>
    </div>
  </header>

  <div class="addr" title={envelope.address}>
    <code>{envelope.address.slice(0, 10)}…{envelope.address.slice(-6)}</code>
  </div>

  {#if $isManager}
    {#if action === null}
      <div class="actions">
        <button type="button" onclick={() => (action = 'move')}>Move</button>
        <button type="button" onclick={() => (action = 'send')}>Send to Withdrawal</button>
      </div>
    {:else if action === 'move'}
      <div class="form">
        <label>
          Destination
          <select bind:value={moveTarget}>
            <option value="" disabled>Select envelope…</option>
            {#each otherEnvelopes() as other}
              <option value={other.name}>{other.name}</option>
            {/each}
          </select>
        </label>
        <label>
          Amount
          <AmountInput
            bind:value={amount}
            symbol={$tokenInfo.symbol}
            max={envelope.balance}
            formatMax={displayBalance}
          />
        </label>
        <div class="submit">
          <TxButton
            label="Move"
            action={moveFunds}
            disabled={!moveTarget || !amount}
            onSuccess={reset}
          />
          <button type="button" class="cancel" onclick={reset}>Cancel</button>
        </div>
      </div>
    {:else if action === 'send'}
      <div class="form">
        <label>
          Amount
          <AmountInput
            bind:value={amount}
            symbol={$tokenInfo.symbol}
            max={envelope.balance}
            formatMax={displayBalance}
          />
        </label>
        <div class="submit">
          <TxButton
            label="Send to Withdrawal"
            action={sendToWithdrawal}
            disabled={!amount}
            onSuccess={reset}
          />
          <button type="button" class="cancel" onclick={reset}>Cancel</button>
        </div>
      </div>
    {/if}
  {/if}
</article>

<style>
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  h3 {
    margin: 0;
    font-size: 18px;
    color: var(--text-h);
    font-weight: 500;
  }
  .bal {
    font-family: var(--mono);
    font-size: 15px;
  }
  .bal .amt {
    color: var(--text-h);
    font-weight: 500;
  }
  .bal .sym {
    color: var(--text);
    margin-left: 4px;
  }
  .addr code {
    font-size: 12px;
    padding: 2px 6px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .actions button {
    font: inherit;
    font-size: 14px;
    padding: 6px 12px;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-h);
    cursor: pointer;
  }
  .actions button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    border-top: 1px dashed var(--border);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: var(--text);
  }
  select {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text-h);
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
  .cancel:hover {
    color: var(--text-h);
  }
</style>

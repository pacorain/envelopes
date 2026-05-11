<script>
  // TxButton: a button that manages pending/success/error states for a transaction.
  //
  // Usage:
  //   <TxButton label="Deposit" action={async () => { await contract.deposit(amount); }} />
  //
  // Props:
  //   label      - button text
  //   action     - async function that sends the transaction; should throw on failure
  //   disabled   - optional additional disabled condition
  //   onSuccess  - optional callback after confirmed success

  let { label, action, disabled = false, onSuccess } = $props();

  let status = $state('idle'); // 'idle' | 'pending' | 'success' | 'error'
  let errorMsg = $state('');
  let txHash = $state('');

  async function handleClick() {
    if (status === 'pending') return;
    status = 'pending';
    errorMsg = '';
    txHash = '';
    try {
      const tx = await action();
      if (tx?.hash) txHash = tx.hash;
      if (tx?.wait) await tx.wait();
      status = 'success';
      onSuccess?.();
      setTimeout(() => { status = 'idle'; txHash = ''; }, 4000);
    } catch (e) {
      status = 'error';
      errorMsg = e.reason ?? e.shortMessage ?? e.message ?? 'Transaction failed';
      setTimeout(() => { status = 'idle'; errorMsg = ''; }, 6000);
    }
  }
</script>

<div class="tx-wrapper">
  <button
    onclick={handleClick}
    disabled={disabled || status === 'pending'}
    class="tx-btn"
    class:pending={status === 'pending'}
    class:success={status === 'success'}
    class:error={status === 'error'}
  >
    {#if status === 'pending'}
      <span class="spinner"></span> Pending…
    {:else if status === 'success'}
      ✓ Done
    {:else if status === 'error'}
      ✗ Failed
    {:else}
      {label}
    {/if}
  </button>

  {#if status === 'error' && errorMsg}
    <p class="tx-error">{errorMsg}</p>
  {/if}

  {#if status === 'success' && txHash}
    <p class="tx-hash">
      <a href="https://basescan.org/tx/{txHash}" target="_blank" rel="noreferrer">
        View on Basescan ↗
      </a>
    </p>
  {/if}
</div>

<style>
  .tx-wrapper {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tx-btn {
    padding: 0.4rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    background: var(--accent);
    color: white;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: background 0.15s;
  }

  .tx-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .tx-btn.success {
    background: var(--success);
  }

  .tx-btn.error {
    background: var(--danger);
  }

  .spinner {
    width: 0.8em;
    height: 0.8em;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tx-error {
    font-size: 0.8rem;
    color: var(--danger);
    margin: 0;
    max-width: 300px;
    word-break: break-word;
  }

  .tx-hash {
    font-size: 0.8rem;
    margin: 0;
  }

  .tx-hash a {
    color: var(--accent);
    text-decoration: none;
  }
</style>

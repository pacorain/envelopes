<script>
  import { refreshState } from '../stores/portfolio.js';

  let {
    label = 'Submit',
    action,
    disabled = false,
    variant = 'primary',
    onSuccess = () => {},
  } = $props();

  let status = $state('idle'); // 'idle' | 'pending' | 'success' | 'error'
  let errorMsg = $state('');
  let txHash = $state('');

  async function handleClick() {
    if (status === 'pending') return;
    status = 'pending';
    errorMsg = '';
    txHash = '';
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'hash' in result) {
        txHash = result.hash;
        if (typeof result.wait === 'function') {
          await result.wait();
        }
      }
      status = 'success';
      await refreshState();
      onSuccess();
      setTimeout(() => {
        if (status === 'success') status = 'idle';
      }, 4000);
    } catch (err) {
      errorMsg = err?.shortMessage ?? err?.message ?? String(err);
      status = 'error';
      setTimeout(() => {
        if (status === 'error') status = 'idle';
      }, 6000);
    }
  }
</script>

<div class="tx">
  <button
    type="button"
    class={variant}
    disabled={disabled || status === 'pending'}
    onclick={handleClick}
  >
    {#if status === 'pending'}
      <span class="spinner" aria-hidden="true"></span>
      Pending…
    {:else if status === 'success'}
      ✓ {label}
    {:else}
      {label}
    {/if}
  </button>
  {#if status === 'error' && errorMsg}
    <div class="err" role="alert">{errorMsg}</div>
  {/if}
</div>

<style>
  .tx {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  button {
    font: inherit;
    font-size: 15px;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity 0.15s, border-color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  button.primary {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
  }
  button.primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  button.secondary {
    background: var(--accent-bg);
    color: var(--accent);
    border: 1px solid var(--accent-border);
  }
  button.secondary:hover:not(:disabled) {
    border-color: var(--accent);
  }
  button.danger {
    background: transparent;
    color: #c0392b;
    border: 1px solid #c0392b;
  }
  button.danger:hover:not(:disabled) {
    background: rgba(192, 57, 43, 0.1);
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .err {
    color: #c0392b;
    font-size: 13px;
    max-width: 360px;
    word-break: break-word;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

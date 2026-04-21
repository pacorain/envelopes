<script>
  import { account, walletError, connectWallet, disconnectWallet } from '../stores/wallet.js';

  function shorten(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
</script>

{#if $account}
  <div class="wallet connected">
    <span class="addr" title={$account}>{shorten($account)}</span>
    <button type="button" onclick={disconnectWallet}>Disconnect</button>
  </div>
{:else}
  <div class="wallet">
    <button type="button" onclick={connectWallet}>Connect Wallet</button>
    {#if $walletError}
      <span class="err">{$walletError}</span>
    {/if}
  </div>
{/if}

<style>
  .wallet {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .addr {
    font-family: var(--mono);
    font-size: 14px;
    padding: 4px 8px;
    background: var(--code-bg);
    border-radius: 4px;
    color: var(--text-h);
  }
  button {
    font: inherit;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--accent-border);
    background: var(--accent-bg);
    color: var(--accent);
    cursor: pointer;
  }
  button:hover {
    border-color: var(--accent);
  }
  .err {
    color: #c0392b;
    font-size: 13px;
  }
</style>

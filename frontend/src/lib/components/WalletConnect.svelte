<script>
  import { account, walletError, wrongNetwork, connectWallet, disconnectWallet, switchToNetwork } from '../stores/wallet.js';
  import { NETWORK_NAME } from '../network.js';

  function shorten(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
</script>

{#if $account}
  <div class="wallet connected">
    <span class="addr" title={$account}>{shorten($account)}</span>
    {#if $wrongNetwork}
      <button type="button" class="switch" onclick={switchToNetwork}>Switch to {NETWORK_NAME}</button>
    {:else}
      <button type="button" onclick={disconnectWallet}>Disconnect</button>
    {/if}
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
  button.switch {
    border-color: #b45309;
    background: #fef3c71a;
    color: #b45309;
  }
  button.switch:hover {
    background: #fef3c733;
    border-color: #92400e;
    color: #92400e;
  }
  @media (prefers-color-scheme: dark) {
    button.switch {
      border-color: #f59e0b;
      background: #92400e26;
      color: #fbbf24;
    }
    button.switch:hover {
      background: #92400e44;
      border-color: #fbbf24;
      color: #fde68a;
    }
  }
  .err {
    color: #c0392b;
    font-size: 13px;
  }
</style>

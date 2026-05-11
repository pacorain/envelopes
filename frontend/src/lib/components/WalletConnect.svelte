<script>
  import { wallet } from '../stores/wallet.svelte.js';

  function short(addr) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
  }
</script>

{#if wallet.connected}
  <div class="wallet-chip">
    <span class="address">{short(wallet.account)}</span>
    <button class="disconnect" onclick={() => wallet.disconnect()}>Disconnect</button>
  </div>
{:else}
  <button class="connect-btn" onclick={() => wallet.connect()}>Connect Wallet</button>
{/if}

{#if wallet.error}
  <p class="wallet-error">{wallet.error}</p>
{/if}

<style>
  .wallet-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
  }

  .address {
    font-family: monospace;
    color: var(--text-secondary);
  }

  .disconnect {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
  }

  .disconnect:hover {
    color: var(--danger);
  }

  .connect-btn {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .connect-btn:hover {
    opacity: 0.9;
  }

  .wallet-error {
    color: var(--danger);
    font-size: 0.8rem;
    margin: 0.25rem 0 0;
  }
</style>

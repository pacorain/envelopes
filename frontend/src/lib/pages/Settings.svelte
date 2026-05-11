<script>
  import { portfolio } from '../stores/portfolio.svelte.js';
  import { wallet } from '../stores/wallet.svelte.js';

  let portfolioInput = $state(portfolio.address);
  let tokenInput = $state(portfolio.tokenAddress);
  let saved = $state(false);

  function save() {
    portfolio.saveAddress(portfolioInput.trim());
    portfolio.saveTokenAddress(tokenInput.trim());
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
    if (wallet.provider) portfolio.refresh();
  }
</script>

<div class="page">
  <h1>Settings</h1>

  <section class="card">
    <h2>Portfolio</h2>
    <p class="hint">
      Enter the address of an already-deployed Portfolio contract, or deploy a new one below.
      This address is saved in your browser's local storage.
    </p>

    <label>
      Portfolio contract address
      <input
        type="text"
        placeholder="0x…"
        bind:value={portfolioInput}
        spellcheck="false"
      />
    </label>

    <label>
      Token address
      <input
        type="text"
        placeholder="0x…"
        bind:value={tokenInput}
        spellcheck="false"
      />
      <span class="hint">Default: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)</span>
    </label>

    <div class="actions">
      <button class="primary" onclick={save}>
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  </section>

  <section class="card">
    <h2>Deploy New Portfolio</h2>
    <p class="hint">
      This feature is not yet available in the UI. To deploy a new Portfolio contract,
      use the Hardhat deploy script in the <code>contracts/</code> directory, then paste
      the resulting address above.
    </p>
    <p class="hint">
      Constructor parameters: <code>token_</code> (ERC-20 token address),
      <code>withdrawalAddress_</code> (where funds can be withdrawn).
    </p>
  </section>
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 1rem;
    color: var(--text-primary);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  input[type="text"] {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--accent);
  }

  .hint {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  button.primary {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.45rem 1.2rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
  }

  button.primary:hover {
    opacity: 0.9;
  }

  code {
    background: var(--surface-alt);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.85em;
  }
</style>

<script>
  import { ethers } from 'ethers';
  import { portfolio } from '../stores/portfolio.svelte.js';
  import { wallet } from '../stores/wallet.svelte.js';
  import { PortfolioABI, PortfolioBytecode } from '../abi/Portfolio.js';
  import TxButton from '../components/TxButton.svelte';

  let portfolioInput = $state(portfolio.address);
  let tokenInput = $state(portfolio.tokenAddress);
  let saved = $state(false);

  // Deploy form state
  let deployTokenAddr = $state(portfolio.tokenAddress);
  let deployWithdrawalAddr = $state('');

  function isValidAddress(addr) {
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
  }

  function isInputValid() {
    const p = portfolioInput.trim();
    const t = tokenInput.trim();
    // Allow empty portfolio (meaning: no portfolio configured yet)
    if (p && !isValidAddress(p)) return false;
    // Token address must be valid if provided
    if (t && !isValidAddress(t)) return false;
    return true;
  }

  function save() {
    if (!isInputValid()) return;
    portfolio.saveAddress(portfolioInput.trim());
    portfolio.saveTokenAddress(tokenInput.trim());
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
    if (wallet.provider) portfolio.refresh();
  }

  let portfolioInvalid = $derived(portfolioInput.trim() !== '' && !isValidAddress(portfolioInput.trim()));
  let tokenInvalid = $derived(tokenInput.trim() !== '' && !isValidAddress(tokenInput.trim()));

  let deployTokenInvalid = $derived(!isValidAddress(deployTokenAddr.trim()));
  let deployWithdrawalInvalid = $derived(!isValidAddress(deployWithdrawalAddr.trim()));
  let deployDisabled = $derived(deployTokenInvalid || deployWithdrawalInvalid || !wallet.connected);

  async function deployPortfolio() {
    if (!wallet.signer) throw new Error('Wallet not connected');
    const factory = new ethers.ContractFactory(PortfolioABI, PortfolioBytecode, wallet.signer);
    const contract = await factory.deploy(deployTokenAddr.trim(), deployWithdrawalAddr.trim());
    const deployTx = contract.deploymentTransaction();
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    portfolio.saveAddress(addr);
    portfolioInput = addr;
    return deployTx;
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
        class:invalid={portfolioInvalid}
      />
      {#if portfolioInvalid}
        <span class="field-error">Invalid address format</span>
      {/if}
    </label>

    <label>
      Token address
      <input
        type="text"
        placeholder="0x…"
        bind:value={tokenInput}
        spellcheck="false"
        class:invalid={tokenInvalid}
      />
      {#if tokenInvalid}
        <span class="field-error">Invalid address format</span>
      {:else}
        <span class="hint">Default: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)</span>
      {/if}
    </label>

    <div class="actions">
      <button class="primary" onclick={save} disabled={!isInputValid()}>
        {saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  </section>

  <section class="card">
    <h2>Deploy New Portfolio</h2>
    {#if !wallet.connected}
      <p class="hint">Connect your wallet to deploy a new Portfolio contract.</p>
    {:else}
      <p class="hint">
        Deploy a fresh Portfolio contract. You will be set as admin.
        The portfolio address will be saved automatically on success.
      </p>

      <label>
        Token address
        <input
          type="text"
          placeholder="0x… (ERC-20 token)"
          bind:value={deployTokenAddr}
          spellcheck="false"
          class:invalid={deployTokenInvalid && deployTokenAddr.trim() !== ''}
        />
        {#if deployTokenInvalid && deployTokenAddr.trim() !== ''}
          <span class="field-error">Invalid address format</span>
        {:else}
          <span class="hint">Default: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)</span>
        {/if}
      </label>

      <label>
        Withdrawal address
        <input
          type="text"
          placeholder="0x… (funds exit address)"
          bind:value={deployWithdrawalAddr}
          spellcheck="false"
          class:invalid={deployWithdrawalInvalid && deployWithdrawalAddr.trim() !== ''}
        />
        {#if deployWithdrawalInvalid && deployWithdrawalAddr.trim() !== ''}
          <span class="field-error">Invalid address format</span>
        {:else}
          <span class="hint">The only address funds can be withdrawn to. Use your cold wallet.</span>
        {/if}
      </label>

      <div class="actions">
        <TxButton
          label="Deploy Portfolio"
          action={deployPortfolio}
          disabled={deployDisabled}
          onSuccess={() => {}}
        />
      </div>
    {/if}
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

  input[type="text"].invalid {
    border-color: var(--danger);
  }

  .field-error {
    font-size: 0.78rem;
    color: var(--danger);
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

</style>

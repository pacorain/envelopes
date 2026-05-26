<script>
  import { isAddress, ContractFactory } from 'ethers';
  import { portfolioAddress, tokenAddress, DEFAULT_TOKEN_ADDRESS } from '../stores/settings.js';
  import { signer, wrongNetwork } from '../stores/wallet.js';
  import { PortfolioABI, PortfolioBytecode } from '../abi/Portfolio.js';
  import { NETWORK_NAME } from '../network.js';

  let portfolioInput = $state($portfolioAddress ?? '');
  let tokenInput = $state($tokenAddress ?? DEFAULT_TOKEN_ADDRESS);
  let portfolioError = $state('');
  let tokenError = $state('');
  let saved = $state(false);

  function savePortfolio() {
    portfolioError = '';
    const trimmed = portfolioInput.trim();
    if (trimmed && !isAddress(trimmed)) {
      portfolioError = 'Not a valid Ethereum address.';
      return;
    }
    portfolioAddress.set(trimmed);
    flashSaved();
  }

  function saveToken() {
    tokenError = '';
    const trimmed = tokenInput.trim();
    if (!trimmed || !isAddress(trimmed)) {
      tokenError = 'Not a valid Ethereum address.';
      return;
    }
    tokenAddress.set(trimmed);
    flashSaved();
  }

  function resetToken() {
    tokenInput = DEFAULT_TOKEN_ADDRESS;
    tokenAddress.set(DEFAULT_TOKEN_ADDRESS);
    flashSaved();
  }

  function clearPortfolio() {
    portfolioInput = '';
    portfolioAddress.set('');
    flashSaved();
  }

  function flashSaved() {
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  // Deploy section
  let withdrawalInput = $state('');
  let deployError = $state('');
  let deploying = $state(false);
  let deployedAddress = $state('');

  async function deployPortfolio() {
    deployError = '';
    deployedAddress = '';

    const withdrawal = withdrawalInput.trim();
    if (!withdrawal || !isAddress(withdrawal)) {
      deployError = 'Enter a valid withdrawal address.';
      return;
    }
    if (!$signer) {
      deployError = 'Connect your wallet first.';
      return;
    }
    if ($wrongNetwork) {
      deployError = `Switch to ${NETWORK_NAME} before deploying.`;
      return;
    }

    deploying = true;
    try {
      const factory = new ContractFactory(PortfolioABI, PortfolioBytecode, $signer);
      const contract = await factory.deploy($tokenAddress, withdrawal);
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      deployedAddress = addr;
      portfolioAddress.set(addr);
      portfolioInput = addr;
    } catch (err) {
      deployError = err?.reason ?? err?.message ?? String(err);
    } finally {
      deploying = false;
    }
  }
</script>

<section class="page">
  <header>
    <h1>Settings</h1>
    <p>These values are stored in your browser's local storage. They do not leave this device.</p>
  </header>

  <div class="group">
    <h2>Portfolio Address</h2>
    <p class="hint">The deployed <code>Portfolio.sol</code> contract this UI connects to.</p>
    <div class="row">
      <input
        type="text"
        placeholder="0x…"
        bind:value={portfolioInput}
        spellcheck="false"
        autocomplete="off"
      />
      <button type="button" class="primary" onclick={savePortfolio}>Save</button>
      {#if $portfolioAddress}
        <button type="button" class="danger" onclick={clearPortfolio}>Clear</button>
      {/if}
    </div>
    {#if portfolioError}<div class="err">{portfolioError}</div>{/if}
    {#if $portfolioAddress}
      <div class="current">Current: <code>{$portfolioAddress}</code></div>
    {:else}
      <div class="current muted">No portfolio configured.</div>
    {/if}
  </div>

  <div class="group">
    <h2>Token Address</h2>
    <p class="hint">
      The ERC-20 token the portfolio manages. Default is USDC on {NETWORK_NAME}.
    </p>
    <div class="row">
      <input
        type="text"
        placeholder="0x…"
        bind:value={tokenInput}
        spellcheck="false"
        autocomplete="off"
      />
      <button type="button" class="primary" onclick={saveToken}>Save</button>
      <button type="button" class="secondary" onclick={resetToken}>Reset to USDC</button>
    </div>
    {#if tokenError}<div class="err">{tokenError}</div>{/if}
    <div class="current">Current: <code>{$tokenAddress}</code></div>
  </div>

  <div class="group">
    <h2>Deploy a New Portfolio</h2>
    <p class="hint">
      Deploys a new <code>Portfolio.sol</code> contract from your connected wallet. The deploying
      address becomes the admin. The withdrawal address is the only address funds can be sent to
      outside the portfolio — set this to a wallet you control (e.g. your cold wallet).
    </p>
    <div class="row">
      <input
        type="text"
        placeholder="Withdrawal address (0x…)"
        bind:value={withdrawalInput}
        spellcheck="false"
        autocomplete="off"
        disabled={deploying}
      />
      <button
        type="button"
        class="primary"
        onclick={deployPortfolio}
        disabled={deploying || !$signer || $wrongNetwork}
      >
        {deploying ? 'Deploying…' : 'Deploy Portfolio'}
      </button>
    </div>
    {#if !$signer}
      <div class="hint muted">Connect your wallet to deploy.</div>
    {:else if $wrongNetwork}
      <div class="hint muted">Switch to {NETWORK_NAME} to deploy.</div>
    {/if}
    {#if deployError}<div class="err">{deployError}</div>{/if}
    {#if deployedAddress}
      <div class="current">
        Deployed: <code>{deployedAddress}</code> — saved as your active portfolio.
      </div>
    {/if}
  </div>

  {#if saved}
    <div class="toast" role="status">Saved</div>
  {/if}
</section>

<style>
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 32px;
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
  }
  .hint {
    font-size: 14px;
    color: var(--text);
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
  button {
    font: inherit;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }
  button.primary {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
  }
  button.primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.secondary {
    background: var(--accent-bg);
    color: var(--accent);
    border: 1px solid var(--accent-border);
  }
  button.secondary:hover {
    border-color: var(--accent);
  }
  button.danger {
    background: transparent;
    color: #c0392b;
    border: 1px solid #c0392b;
  }
  button.danger:hover {
    background: rgba(192, 57, 43, 0.1);
  }
  .current {
    font-size: 13px;
    color: var(--text);
  }
  .current.muted {
    font-style: italic;
  }
  .hint.muted {
    font-style: italic;
  }
  .current code {
    font-size: 13px;
  }
  .err {
    color: #c0392b;
    font-size: 13px;
  }
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 10px 18px;
    background: var(--accent);
    color: #fff;
    border-radius: 6px;
    box-shadow: var(--shadow);
  }
</style>

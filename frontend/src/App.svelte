<script>
  import { onMount } from 'svelte';
  import Nav from './lib/components/Nav.svelte';
  import PortfolioPage from './lib/pages/Portfolio.svelte';
  import AdminPage from './lib/pages/Admin.svelte';
  import SettingsPage from './lib/pages/Settings.svelte';
  import { initWalletListeners } from './lib/stores/wallet.js';
  import { NETWORK_NAME } from './lib/network.js';

  const isTestnet = import.meta.env.VITE_NETWORK !== 'mainnet';

  const BANNER_KEY = 'disclaimer_dismissed_at';
  const BANNER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  let currentPage = $state(window.location.hash || '#/');
  let bannerDismissed = $state(false);

  function syncHash() {
    currentPage = window.location.hash || '#/';
  }

  function dismissBanner() {
    bannerDismissed = true;
    localStorage.setItem(BANNER_KEY, Date.now().toString());
  }

  onMount(() => {
    const dismissedAt = localStorage.getItem(BANNER_KEY);
    bannerDismissed = dismissedAt !== null && Date.now() - Number(dismissedAt) < BANNER_TTL_MS;
    initWalletListeners();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  });
</script>

<div class="app">
  {#if !bannerDismissed}
    <div class="disclaimer-banner" role="alert">
      <span class="disclaimer-icon">⚠</span>
      <span class="disclaimer-text">
        This project is in development and has not been audited. Contract discrepancies may exist and use may result in loss of funds.
        <a href="https://github.com/pacorain/envelopes" target="_blank" rel="noopener noreferrer">Learn more</a>
      </span>
      <button class="dismiss-btn" onclick={dismissBanner} aria-label="Dismiss warning">✕</button>
    </div>
  {/if}
  <Nav {currentPage} />
  {#if isTestnet}
    <div class="testnet-banner" role="status">
      <strong>Testnet mode</strong> — connected to {NETWORK_NAME}. Transactions use test funds only.
    </div>
  {/if}
  <main>
    {#if currentPage === '#/admin'}
      <AdminPage />
    {:else if currentPage === '#/settings'}
      <SettingsPage />
    {:else}
      <PortfolioPage />
    {/if}
  </main>
  <footer class="app-footer">
    <a href="https://github.com/pacorain/envelopes/blob/main/README.md" target="_blank" rel="noopener noreferrer">README</a>
    <span class="footer-sep">·</span>
    <a href="https://github.com/pacorain/envelopes" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>
</div>

<style>
  .app {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
  }
  main {
    flex: 1;
  }
  .disclaimer-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: #7c4a001a;
    border-bottom: 1px solid #b8690033;
    color: #7c3a00;
    font-size: 14px;
  }
  @media (prefers-color-scheme: dark) {
    .disclaimer-banner {
      background: #92400e26;
      border-bottom-color: #b4530044;
      color: #fbbf24;
    }
  }
  .disclaimer-icon {
    flex-shrink: 0;
    font-size: 16px;
  }
  .disclaimer-text {
    flex: 1;
    line-height: 1.4;
  }
  .disclaimer-text a {
    color: inherit;
    font-weight: 500;
  }
  .dismiss-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
    opacity: 0.7;
    line-height: 1;
  }
  .dismiss-btn:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.08);
  }
  @media (prefers-color-scheme: dark) {
    .dismiss-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
  .testnet-banner {
    background: #92400e;
    color: #fef3c7;
    text-align: center;
    padding: 6px 16px;
    font-size: 14px;
  }
  .app-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 12px;
    color: #888;
  }
  .app-footer a {
    color: inherit;
    text-decoration: none;
  }
  .app-footer a:hover {
    text-decoration: underline;
  }
  .footer-sep {
    opacity: 0.5;
  }
  @media (prefers-color-scheme: dark) {
    .app-footer {
      border-top-color: rgba(255, 255, 255, 0.08);
      color: #666;
    }
  }
</style>

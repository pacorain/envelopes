<script>
  import { onMount } from 'svelte';
  import Nav from './lib/components/Nav.svelte';
  import PortfolioPage from './lib/pages/Portfolio.svelte';
  import AdminPage from './lib/pages/Admin.svelte';
  import SettingsPage from './lib/pages/Settings.svelte';
  import { initWalletListeners } from './lib/stores/wallet.js';

  const BANNER_KEY = 'disclaimer_dismissed';

  let currentPage = $state(window.location.hash || '#/');
  let bannerDismissed = $state(false);

  function syncHash() {
    currentPage = window.location.hash || '#/';
  }

  function dismissBanner() {
    bannerDismissed = true;
    localStorage.setItem(BANNER_KEY, '1');
  }

  onMount(() => {
    bannerDismissed = localStorage.getItem(BANNER_KEY) === '1';
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
  <main>
    {#if currentPage === '#/admin'}
      <AdminPage />
    {:else if currentPage === '#/settings'}
      <SettingsPage />
    {:else}
      <PortfolioPage />
    {/if}
  </main>
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
</style>

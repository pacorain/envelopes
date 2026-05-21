<script>
  import { onMount } from 'svelte';
  import Nav from './lib/components/Nav.svelte';
  import PortfolioPage from './lib/pages/Portfolio.svelte';
  import AdminPage from './lib/pages/Admin.svelte';
  import SettingsPage from './lib/pages/Settings.svelte';
  import { initWalletListeners } from './lib/stores/wallet.js';

  let currentPage = $state(window.location.hash || '#/');

  function syncHash() {
    currentPage = window.location.hash || '#/';
  }

  onMount(() => {
    initWalletListeners();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  });
</script>

<div class="app">
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
</style>

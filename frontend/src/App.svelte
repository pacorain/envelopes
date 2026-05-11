<script>
  import Nav from './lib/components/Nav.svelte';
  import PortfolioPage from './lib/pages/Portfolio.svelte';
  import AdminPage from './lib/pages/Admin.svelte';
  import SettingsPage from './lib/pages/Settings.svelte';

  function getPage() {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/admin')) return '#/admin';
    if (hash.startsWith('#/settings')) return '#/settings';
    return '#/';
  }

  let currentPage = $state(getPage());

  $effect(() => {
    function onHashChange() {
      currentPage = getPage();
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });
</script>

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

<style>
  main {
    min-height: calc(100vh - 56px);
  }
</style>

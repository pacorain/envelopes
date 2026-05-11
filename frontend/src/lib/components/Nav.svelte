<script>
  import WalletConnect from './WalletConnect.svelte';

  let { currentPage } = $props();

  const pages = [
    { hash: '#/', label: 'Portfolio' },
    { hash: '#/admin', label: 'Admin' },
    { hash: '#/settings', label: 'Settings' },
  ];
</script>

<nav>
  <a class="brand" href="#/">Envelopes</a>
  <div class="links">
    {#each pages as page}
      <a
        href={page.hash}
        class:active={currentPage === page.hash}
      >{page.label}</a>
    {/each}
  </div>
  <div class="wallet-area">
    <WalletConnect />
  </div>
</nav>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--text-primary);
    text-decoration: none;
  }

  .links {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .links a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.25rem 0;
    border-bottom: 2px solid transparent;
  }

  .links a:hover {
    color: var(--text-primary);
  }

  .links a.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .wallet-area {
    margin-left: auto;
  }
</style>

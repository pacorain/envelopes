<script>
  import WalletConnect from './WalletConnect.svelte';
  import { isAdmin } from '../stores/portfolio.js';

  let { currentPage } = $props();

  const links = [
    { hash: '#/', label: 'Portfolio' },
    { hash: '#/admin', label: 'Admin' },
    { hash: '#/settings', label: 'Settings' },
  ];
</script>

<nav>
  <div class="brand">Envelope</div>
  <ul class="links">
    {#each links as link}
      <li>
        <a
          href={link.hash}
          class:active={currentPage === link.hash}
          class:disabled={link.hash === '#/admin' && !$isAdmin}
        >
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
  <div class="wallet">
    <WalletConnect />
  </div>
</nav>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-family: var(--heading);
    font-weight: 500;
    color: var(--text-h);
    font-size: 20px;
  }
  .links {
    display: flex;
    gap: 4px;
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
  }
  .links a {
    text-decoration: none;
    color: var(--text);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 15px;
  }
  .links a:hover {
    background: var(--code-bg);
  }
  .links a.active {
    color: var(--accent);
    background: var(--accent-bg);
  }
  .links a.disabled {
    opacity: 0.45;
  }
  .wallet {
    display: flex;
    align-items: center;
  }
  @media (max-width: 640px) {
    nav {
      flex-wrap: wrap;
      gap: 12px;
    }
  }
</style>

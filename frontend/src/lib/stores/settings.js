import { writable } from 'svelte/store';

const PORTFOLIO_KEY = 'envelope.portfolioAddress';
const TOKEN_KEY = 'envelope.tokenAddress';

// USDC on Base mainnet — verified constant from README.
export const DEFAULT_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function persistedStore(key, initial) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const store = writable(stored ?? initial);
  store.subscribe((value) => {
    if (typeof localStorage === 'undefined') return;
    if (value === null || value === undefined || value === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  });
  return store;
}

export const portfolioAddress = persistedStore(PORTFOLIO_KEY, '');
export const tokenAddress = persistedStore(TOKEN_KEY, DEFAULT_TOKEN_ADDRESS);

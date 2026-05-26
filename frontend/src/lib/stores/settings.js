import { writable } from 'svelte/store';
import { DEFAULT_USDC_ADDRESS } from '../network.js';

const PORTFOLIO_KEY = 'envelope.portfolioAddress';
const TOKEN_KEY = 'envelope.tokenAddress';

// USDC address for the configured network (Base Sepolia by default; mainnet when VITE_NETWORK=mainnet).
export const DEFAULT_TOKEN_ADDRESS = DEFAULT_USDC_ADDRESS;

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

import { writable, get } from 'svelte/store';
import { BrowserProvider } from 'ethers';

export const provider = writable(null);
export const signer = writable(null);
export const account = writable(null);
export const chainId = writable(null);
export const walletError = writable('');

function hasEthereum() {
  return typeof window !== 'undefined' && window.ethereum;
}

export async function connectWallet() {
  walletError.set('');
  if (!hasEthereum()) {
    walletError.set('No Ethereum wallet detected. Install MetaMask or another wallet.');
    return;
  }
  try {
    const bp = new BrowserProvider(window.ethereum);
    const accounts = await bp.send('eth_requestAccounts', []);
    const s = await bp.getSigner();
    const net = await bp.getNetwork();
    provider.set(bp);
    signer.set(s);
    account.set(accounts[0]);
    chainId.set(Number(net.chainId));
  } catch (err) {
    walletError.set(err?.message ?? String(err));
  }
}

export function disconnectWallet() {
  provider.set(null);
  signer.set(null);
  account.set(null);
  chainId.set(null);
}

export function initWalletListeners() {
  if (!hasEthereum()) return;
  window.ethereum.on?.('accountsChanged', (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
    } else {
      account.set(accounts[0]);
      // Refresh signer on account change
      const bp = get(provider);
      if (bp) bp.getSigner().then((s) => signer.set(s));
    }
  });
  window.ethereum.on?.('chainChanged', (cid) => {
    chainId.set(Number(cid));
    // Rebuild provider/signer on chain change
    const bp = new BrowserProvider(window.ethereum);
    provider.set(bp);
    bp.getSigner().then((s) => signer.set(s)).catch(() => signer.set(null));
  });
}

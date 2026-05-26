import { writable, get, derived } from 'svelte/store';
import { BrowserProvider } from 'ethers';
import { EXPECTED_CHAIN_ID, NETWORK_NAME, ADD_CHAIN_PARAMS } from '../network.js';

export const provider = writable(null);
export const signer = writable(null);
export const account = writable(null);
export const chainId = writable(null);
export const walletError = writable('');

/** True when the wallet is connected to a chain other than the expected one. */
export const wrongNetwork = derived(
  chainId,
  ($chainId) => $chainId !== null && $chainId !== EXPECTED_CHAIN_ID,
);

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
    const cid = Number(net.chainId);
    provider.set(bp);
    signer.set(s);
    account.set(accounts[0]);
    chainId.set(cid);
    if (cid !== EXPECTED_CHAIN_ID) {
      walletError.set(
        `Wrong network. Please switch to ${NETWORK_NAME} (chain ID ${EXPECTED_CHAIN_ID}). You are on chain ${cid}.`,
      );
    }
  } catch (err) {
    walletError.set(err?.message ?? String(err));
  }
}

export async function switchToNetwork() {
  walletError.set('');
  if (!hasEthereum()) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ADD_CHAIN_PARAMS.chainId }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ADD_CHAIN_PARAMS],
        });
      } catch (addErr) {
        walletError.set(addErr?.message ?? String(addErr));
      }
    } else {
      walletError.set(err?.message ?? String(err));
    }
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

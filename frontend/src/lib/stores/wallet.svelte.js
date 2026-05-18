import { ethers } from 'ethers';

// Base mainnet chain ID
const BASE_CHAIN_ID = 8453n;

class WalletState {
  provider = $state(null);
  signer = $state(null);
  account = $state(null);
  error = $state(null);
  wrongNetwork = $state(false);

  get connected() {
    return this.account !== null;
  }

  async connect() {
    this.error = null;
    this.wrongNetwork = false;
    if (!window.ethereum) {
      this.error = 'No wallet detected. Install MetaMask or a compatible browser wallet.';
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      const { chainId } = await provider.getNetwork();
      if (chainId !== BASE_CHAIN_ID) {
        this.wrongNetwork = true;
        this.error = `Wrong network. Please switch to Base (chain ID 8453). You are on chain ${chainId}.`;
        return;
      }

      const signer = await provider.getSigner();
      this.provider = provider;
      this.signer = signer;
      this.account = await signer.getAddress();
    } catch (e) {
      this.error = e.message ?? 'Failed to connect wallet';
    }
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.error = null;
    this.wrongNetwork = false;
  }

  async switchToBase() {
    if (!window.ethereum) return;
    this.error = null;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      });
      // On success MetaMask fires chainChanged → page reloads → connect() re-runs
    } catch (e) {
      if (e.code === 4902) {
        // Base not in wallet yet — add it, then the switch completes automatically
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } catch (addError) {
          this.error = addError.message ?? 'Failed to add Base network to wallet';
        }
      } else if (e.code !== 4001) {
        // 4001 = user rejected — stay silent; anything else is unexpected
        this.error = e.message ?? 'Failed to switch network';
      }
    }
  }
}

export const wallet = new WalletState();

if (typeof window !== 'undefined' && window.ethereum) {
  // Keep wallet in sync when the user switches accounts
  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      wallet.disconnect();
    } else if (wallet.connected) {
      wallet.account = accounts[0];
      const provider = new ethers.BrowserProvider(window.ethereum);
      wallet.provider = provider;
      wallet.signer = await provider.getSigner();
    }
  });

  // Reload on network change so all state is re-fetched for the new chain
  window.ethereum.on('chainChanged', () => {
    window.location.reload();
  });
}

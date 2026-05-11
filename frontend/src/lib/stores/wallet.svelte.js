import { ethers } from 'ethers';

class WalletState {
  provider = $state(null);
  signer = $state(null);
  account = $state(null);
  error = $state(null);

  get connected() {
    return this.account !== null;
  }

  async connect() {
    this.error = null;
    if (!window.ethereum) {
      this.error = 'No wallet detected. Install MetaMask or a compatible browser wallet.';
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
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
  }
}

export const wallet = new WalletState();

// Keep wallet in sync when the user switches accounts in MetaMask
if (typeof window !== 'undefined' && window.ethereum) {
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
}

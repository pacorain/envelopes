// Network configuration driven by the VITE_NETWORK build-time env var.
//
// Set VITE_NETWORK=mainnet for production builds (GitHub Pages workflow does this).
// Omit it (or set to anything else) to target Base Sepolia — safe for development
// and testing without risk to real funds.

const isMainnet = import.meta.env.VITE_NETWORK === 'mainnet';

/** Expected chain ID. 84532 = Base Sepolia (default), 8453 = Base Mainnet. */
export const EXPECTED_CHAIN_ID = isMainnet ? 8453 : 84532;

/** Human-readable network name for error messages. */
export const NETWORK_NAME = isMainnet ? 'Base Mainnet' : 'Base Sepolia';

/** Default USDC address for the configured network. */
export const DEFAULT_USDC_ADDRESS = isMainnet
  ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

/** Parameters for wallet_addEthereumChain, used as a fallback when the chain isn't in the wallet. */
export const ADD_CHAIN_PARAMS = isMainnet
  ? {
      chainId: '0x2105',
      chainName: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    }
  : {
      chainId: '0x14A34',
      chainName: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia-explorer.base.org'],
    };

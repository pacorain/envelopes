import { ethers } from 'ethers';
import { wallet } from './wallet.svelte.js';
import { PortfolioABI, ERC20ABI } from '../abi/Portfolio.js';
import { EnvelopeABI } from '../abi/Envelope.js';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

class PortfolioState {
  address = $state(localStorage.getItem('envelope.portfolioAddress') ?? '');
  tokenAddress = $state(localStorage.getItem('envelope.tokenAddress') ?? USDC_BASE);

  // Loaded contract state
  token = $state(null);            // on-chain token address (from contract.token())
  decimals = $state(6);            // on-chain token decimals; default 6 matches USDC
  admin = $state(null);
  pendingAdmin = $state(null);
  withdrawalAddress = $state(null);
  isAdmin = $state(false);
  isManager = $state(false);
  unallocated = $state(0n);
  envelopes = $state([]);

  loading = $state(false);
  error = $state(null);

  get contract() {
    if (!this.address || !wallet.provider) return null;
    return new ethers.Contract(this.address, PortfolioABI, wallet.signer ?? wallet.provider);
  }

  // Prefer the on-chain token address (set by refresh()) over the localStorage default.
  // Falls back to tokenAddress so the getter works before a portfolio is loaded.
  get tokenContract() {
    const addr = this.token ?? this.tokenAddress;
    if (!addr || !wallet.provider) return null;
    return new ethers.Contract(addr, ERC20ABI, wallet.signer ?? wallet.provider);
  }

  saveAddress(addr) {
    this.address = addr;
    localStorage.setItem('envelope.portfolioAddress', addr);
  }

  saveTokenAddress(addr) {
    this.tokenAddress = addr;
    localStorage.setItem('envelope.tokenAddress', addr);
  }

  async refresh() {
    if (!this.contract) return;
    this.loading = true;
    this.error = null;
    try {
      const contract = this.contract;
      const account = wallet.account;

      const [tokenAddr, adminAddr, pendingAdminAddr, withdrawalAddr, unallocated] = await Promise.all([
        contract.token(),
        contract.admin(),
        contract.pendingAdmin(),
        contract.withdrawalAddress(),
        contract.unallocated(),
      ]);

      this.token = tokenAddr;
      const tokenErc20 = new ethers.Contract(tokenAddr, ERC20ABI, wallet.provider);
      this.decimals = await tokenErc20.decimals();
      this.admin = adminAddr;
      this.pendingAdmin = pendingAdminAddr === ethers.ZeroAddress ? null : pendingAdminAddr;
      this.withdrawalAddress = withdrawalAddr;
      this.unallocated = unallocated;
      this.isAdmin = account?.toLowerCase() === adminAddr.toLowerCase();
      this.isManager = this.isAdmin || (account ? await contract.managers(account) : false);

      // Load envelopes from EnvelopeCreated events, then resolve each index
      this.envelopes = await this._loadEnvelopes();
    } catch (e) {
      this.error = e.message ?? 'Failed to load portfolio';
    } finally {
      this.loading = false;
    }
  }

  async _loadEnvelopes() {
    const contract = this.contract;
    const provider = wallet.provider;
    if (!contract || !provider) return [];

    // Query all EnvelopeCreated events to discover envelope indices and names
    const filter = contract.filters.EnvelopeCreated();
    const events = await contract.queryFilter(filter);

    const envelopes = [];
    for (const event of events) {
      const index = Number(event.args.index);
      // Check if still active (not deleted)
      const addr = await contract.envelopes(index);
      if (addr === ethers.ZeroAddress) continue;

      const envContract = new ethers.Contract(addr, EnvelopeABI, provider);
      const [rawName, balance] = await Promise.all([
        envContract.name(),
        envContract.balance(),
      ]);

      envelopes.push({
        index,
        address: addr,
        name: ethers.decodeBytes32String(rawName),
        balance,
      });
    }

    return envelopes.sort((a, b) => a.index - b.index);
  }
}

export const portfolio = new PortfolioState();

/** Format a token amount (bigint) for display using the loaded token's decimals */
export function formatAmount(amount) {
  return ethers.formatUnits(amount, portfolio.decimals);
}

/** Parse a user-entered amount string to bigint using the loaded token's decimals */
export function parseAmount(str) {
  return ethers.parseUnits(str, portfolio.decimals);
}

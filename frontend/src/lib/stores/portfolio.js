import { writable, derived, get } from 'svelte/store';
import { Contract, decodeBytes32String } from 'ethers';
import { PortfolioABI } from '../abi/Portfolio.js';
import { EnvelopeABI } from '../abi/Envelope.js';
import { ERC20ABI } from '../abi/ERC20.js';
import { provider, signer, account } from './wallet.js';
import { portfolioAddress } from './settings.js';

export const portfolioContract = derived(
  [signer, provider, portfolioAddress],
  ([$signer, $provider, $addr]) => {
    if (!$addr) return null;
    const runner = $signer ?? $provider;
    if (!runner) return null;
    return new Contract($addr, PortfolioABI, runner);
  }
);

export const isAdmin = writable(false);
export const isManager = writable(false);
export const adminAddress = writable(null);
export const withdrawalAddress = writable(null);
export const managers = writable([]);
export const unallocated = writable(0n);
export const envelopes = writable([]); // [{name, nameBytes32, address, balance}]
export const tokenInfo = writable({ address: null, decimals: 6, symbol: 'USDC' });
export const loading = writable(false);
export const loadError = writable('');

function safeDecodeName(bytes32) {
  try {
    return decodeBytes32String(bytes32);
  } catch {
    return bytes32;
  }
}

async function readManagerList(contract) {
  // managerList() may not exist on every Portfolio implementation.
  // Fall back to parsing ManagerAdded/ManagerRemoved events if needed.
  try {
    return await contract.managerList();
  } catch {
    return null;
  }
}

async function readManagersFromEvents(contract) {
  try {
    const added = await contract.queryFilter(contract.filters.ManagerAdded(), 0, 'latest');
    const removed = await contract.queryFilter(contract.filters.ManagerRemoved(), 0, 'latest');
    const set = new Set();
    for (const e of added) set.add(e.args.manager);
    for (const e of removed) set.delete(e.args.manager);
    // Verify still active (defensive)
    const result = [];
    for (const addr of set) {
      if (await contract.isManager(addr)) result.push(addr);
    }
    return result;
  } catch {
    return [];
  }
}

export async function refreshState() {
  const contract = get(portfolioContract);
  const acct = get(account);
  if (!contract) {
    isAdmin.set(false);
    isManager.set(false);
    adminAddress.set(null);
    withdrawalAddress.set(null);
    managers.set([]);
    unallocated.set(0n);
    envelopes.set([]);
    return;
  }

  loading.set(true);
  loadError.set('');
  try {
    const [adminAddr, wAddr, tokenAddr, unalloc, envList] = await Promise.all([
      contract.admin(),
      contract.withdrawalAddress(),
      contract.token(),
      contract.unallocated(),
      contract.envelopeList(),
    ]);

    adminAddress.set(adminAddr);
    withdrawalAddress.set(wAddr);
    unallocated.set(unalloc);

    // Token metadata
    const runner = contract.runner;
    const token = new Contract(tokenAddr, ERC20ABI, runner);
    let decimals = 6;
    let symbol = 'TOKEN';
    try {
      [decimals, symbol] = await Promise.all([token.decimals(), token.symbol()]);
      decimals = Number(decimals);
    } catch {
      // keep defaults
    }
    tokenInfo.set({ address: tokenAddr, decimals, symbol });

    // Envelope details
    const envData = await Promise.all(
      envList.map(async (nameBytes32) => {
        const addr = await contract.envelopes(nameBytes32);
        let balance = 0n;
        try {
          const env = new Contract(addr, EnvelopeABI, runner);
          balance = await env.balance();
        } catch {
          // envelope may not yet be queryable
        }
        return {
          name: safeDecodeName(nameBytes32),
          nameBytes32,
          address: addr,
          balance,
        };
      })
    );
    envelopes.set(envData);

    // Managers
    let managerAddrs = await readManagerList(contract);
    if (!managerAddrs) managerAddrs = await readManagersFromEvents(contract);
    managers.set(managerAddrs);

    // Roles for connected account
    if (acct) {
      isAdmin.set(acct.toLowerCase() === adminAddr.toLowerCase());
      try {
        isManager.set(await contract.isManager(acct));
      } catch {
        isManager.set(false);
      }
    } else {
      isAdmin.set(false);
      isManager.set(false);
    }
  } catch (err) {
    loadError.set(err?.shortMessage ?? err?.message ?? String(err));
  } finally {
    loading.set(false);
  }
}

// Re-read state whenever the contract identity or connected account changes.
let lastKey = '';
derived(
  [portfolioContract, account],
  ([$contract, $account]) => `${$contract?.target ?? ''}:${$account ?? ''}`
).subscribe((key) => {
  if (key === lastKey) return;
  lastKey = key;
  refreshState();
});

// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {Portfolio} from "../../contracts/Portfolio.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";

/// @dev Handler used by PortfolioInvariant.t.sol.
///
/// Exposes two categories of actions for the fuzzer:
///   1. Legitimate operations — called as manager or admin, update ghost variables.
///   2. Attack surface — called as an unauthorised stranger or as manager
///      attempting admin-only actions.  Outcomes are recorded in ghost booleans
///      so the invariant contract can assert they always fail.
contract PortfolioHandler is CommonBase, StdCheats, StdUtils {
    Portfolio public portfolio;
    MockERC20 public token;

    address public immutable admin;
    address public immutable manager;
    address public immutable stranger;
    address public immutable withdrawalAddress;

    // Ghost variables — fund conservation
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;
    uint256 public ghost_withdrawalInitialBalance;

    // Ghost variables — access control
    bool public ghost_strangerSucceeded;
    bool public ghost_managerChangedWithdrawal;
    bool public ghost_managerAddedManager;
    bool public ghost_managerRemovedManager;

    uint256[] internal _envelopeIndices;

    uint256 internal constant MAX_ENVELOPES = 4;
    uint256 internal constant MAX_AMOUNT = 1_000_000e6;

    constructor(
        Portfolio portfolio_,
        MockERC20 token_,
        address admin_,
        address manager_,
        address stranger_,
        address withdrawalAddress_
    ) {
        portfolio = portfolio_;
        token = token_;
        admin = admin_;
        manager = manager_;
        stranger = stranger_;
        withdrawalAddress = withdrawalAddress_;
        ghost_withdrawalInitialBalance = token_.balanceOf(withdrawalAddress_);
    }

    // ─── Legitimate fund operations ───────────────────────────────────────────

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, MAX_AMOUNT);
        token.mint(address(this), amount);
        token.approve(address(portfolio), amount);
        portfolio.deposit(amount);
        ghost_totalDeposited += amount;
    }

    function allocate(uint256 indexSeed, uint256 amount) external {
        if (_envelopeIndices.length == 0) return;
        uint256 idx = _envelopeIndices[indexSeed % _envelopeIndices.length];
        uint256 unalloc = portfolio.unallocated();
        if (unalloc == 0) return;
        amount = bound(amount, 1, unalloc);
        vm.prank(manager);
        portfolio.allocate(idx, amount);
    }

    function moveFunds(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        if (_envelopeIndices.length < 2) return;
        uint256 fi = fromSeed % _envelopeIndices.length;
        uint256 ti = toSeed % _envelopeIndices.length;
        if (fi == ti) return;
        uint256 fromIdx = _envelopeIndices[fi];
        uint256 toIdx   = _envelopeIndices[ti];
        address fromAddr = portfolio.envelopes(fromIdx);
        uint256 bal = token.balanceOf(fromAddr);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(manager);
        portfolio.moveFunds(fromIdx, toIdx, amount);
    }

    function withdrawUnallocated(uint256 amount) external {
        uint256 unalloc = portfolio.unallocated();
        if (unalloc == 0) return;
        amount = bound(amount, 1, unalloc);
        vm.prank(manager);
        portfolio.withdrawUnallocated(amount);
        ghost_totalWithdrawn += amount;
    }

    function withdrawFromEnvelope(uint256 indexSeed, uint256 amount) external {
        if (_envelopeIndices.length == 0) return;
        uint256 idx = _envelopeIndices[indexSeed % _envelopeIndices.length];
        address envAddr = portfolio.envelopes(idx);
        uint256 bal = token.balanceOf(envAddr);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(manager);
        portfolio.withdrawFromEnvelope(idx, amount);
        ghost_totalWithdrawn += amount;
    }

    function createEnvelope(bytes32 name) external {
        if (_envelopeIndices.length >= MAX_ENVELOPES) return;
        vm.prank(manager);
        uint256 idx = portfolio.createEnvelope(name);
        _envelopeIndices.push(idx);
    }

    // ─── Access control: stranger attacks ────────────────────────────────────

    function strangerAllocate(uint256 indexSeed, uint256 amount) external {
        if (_envelopeIndices.length == 0) return;
        uint256 idx = _envelopeIndices[indexSeed % _envelopeIndices.length];
        amount = bound(amount, 1, MAX_AMOUNT);
        vm.prank(stranger);
        try portfolio.allocate(idx, amount) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerWithdrawUnallocated(uint256 amount) external {
        amount = bound(amount, 1, MAX_AMOUNT);
        vm.prank(stranger);
        try portfolio.withdrawUnallocated(amount) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerWithdrawFromEnvelope(uint256 indexSeed, uint256 amount) external {
        if (_envelopeIndices.length == 0) return;
        uint256 idx = _envelopeIndices[indexSeed % _envelopeIndices.length];
        amount = bound(amount, 1, MAX_AMOUNT);
        vm.prank(stranger);
        try portfolio.withdrawFromEnvelope(idx, amount) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerMoveFunds(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        if (_envelopeIndices.length < 2) return;
        amount = bound(amount, 1, MAX_AMOUNT);
        uint256 fi = fromSeed % _envelopeIndices.length;
        uint256 ti = toSeed % _envelopeIndices.length;
        if (fi == ti) ti = (fi + 1) % _envelopeIndices.length;
        vm.prank(stranger);
        try portfolio.moveFunds(_envelopeIndices[fi], _envelopeIndices[ti], amount) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerCreateEnvelope(bytes32 name) external {
        vm.prank(stranger);
        try portfolio.createEnvelope(name) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerSetWithdrawalAddress(address addr) external {
        if (addr == address(0)) return;
        vm.prank(stranger);
        try portfolio.setWithdrawalAddress(addr) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerAddManager(address addr) external {
        if (addr == address(0)) return;
        vm.prank(stranger);
        try portfolio.addManager(addr) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    function strangerRemoveManager(address addr) external {
        vm.prank(stranger);
        try portfolio.removeManager(addr) {
            ghost_strangerSucceeded = true;
        } catch {}
    }

    // ─── Access control: manager escalation attempts ──────────────────────────

    function managerSetWithdrawalAddress(address addr) external {
        if (addr == address(0)) return;
        vm.prank(manager);
        try portfolio.setWithdrawalAddress(addr) {
            ghost_managerChangedWithdrawal = true;
        } catch {}
    }

    function managerAddManager(address addr) external {
        if (addr == address(0)) return;
        vm.prank(manager);
        try portfolio.addManager(addr) {
            ghost_managerAddedManager = true;
        } catch {}
    }

    function managerRemoveManager(address addr) external {
        vm.prank(manager);
        try portfolio.removeManager(addr) {
            ghost_managerRemovedManager = true;
        } catch {}
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Sum of token balances held by the portfolio contract and all its
    ///         active envelopes.
    function totalSystemBalance() external view returns (uint256) {
        uint256 total = token.balanceOf(address(portfolio));
        for (uint256 i = 0; i < _envelopeIndices.length; i++) {
            total += token.balanceOf(portfolio.envelopes(_envelopeIndices[i]));
        }
        return total;
    }
}

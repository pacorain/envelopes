// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Portfolio
 * @notice The central contract for the envelope budgeting system.
 *
 * Portfolio holds the admin role and is the sole authorized caller for all
 * Envelope contracts it deploys. All permission logic lives here; Envelope
 * contracts are dumb vaults with no independent authorization.
 */
contract Portfolio {
    /// @notice The ERC-20 token used across this portfolio (e.g. USDC).
    address public immutable token;

    /// @notice The admin address — set to the deployer. Privileged operations only.
    address public admin;

    /// @notice The only external address to which funds may be withdrawn.
    address public withdrawalAddress;

    error OnlyAdmin();
    error ZeroAddress();

    event WithdrawalAddressSet(address indexed newWithdrawalAddress);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    /**
     * @param token_             The ERC-20 token address for this portfolio.
     * @param withdrawalAddress_ The initial withdrawal address (must be non-zero).
     */
    constructor(address token_, address withdrawalAddress_) {
        if (token_ == address(0)) revert ZeroAddress();
        if (withdrawalAddress_ == address(0)) revert ZeroAddress();
        token = token_;
        admin = msg.sender;
        withdrawalAddress = withdrawalAddress_;
        emit WithdrawalAddressSet(withdrawalAddress_);
    }

    /**
     * @notice Update the withdrawal address.
     * @dev Admin only. Reverts on zero address.
     * @param newWithdrawalAddress The new withdrawal address.
     */
    function setWithdrawalAddress(address newWithdrawalAddress) external onlyAdmin {
        if (newWithdrawalAddress == address(0)) revert ZeroAddress();
        withdrawalAddress = newWithdrawalAddress;
        emit WithdrawalAddressSet(newWithdrawalAddress);
    }
}

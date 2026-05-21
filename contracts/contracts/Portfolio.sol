// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Portfolio
 * @notice The central contract for the envelope budgeting system.
 *
 * Portfolio holds the admin role and is the sole authorized caller for all
 * Envelope contracts it deploys. All permission logic lives here; Envelope
 * contracts are dumb vaults with no independent authorization.
 */
contract Portfolio {
    using SafeERC20 for IERC20;

    /// @notice The ERC-20 token used across this portfolio (e.g. USDC).
    address public immutable token;

    /// @notice The admin address — set to the deployer. Privileged operations only.
    address public admin;

    /// @notice Pending admin address proposed by the current admin. Must call acceptAdmin() to take effect.
    address public pendingAdmin;

    /// @notice The only external address to which funds may be withdrawn.
    address public withdrawalAddress;

    /// @notice Addresses granted the manager role. Admins are implicitly managers.
    mapping(address => bool) public managers;

    error OnlyAdmin();
    error OnlyPendingAdmin();
    error OnlyManager();
    error ZeroAddress();
    error InvalidToken();
    error ETHNotAccepted();
    error InsufficientBalance();

    event Deposited(address indexed from, uint256 amount);
    event UnallocatedWithdrawn(uint256 amount);
    event WithdrawalAddressSet(address indexed newWithdrawalAddress);
    event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event AdminTransferCancelled(address indexed admin, address indexed cancelledPendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyManager() {
        if (msg.sender != admin && !managers[msg.sender]) revert OnlyManager();
        _;
    }

    /**
     * @param token_             The ERC-20 token address for this portfolio.
     * @param withdrawalAddress_ The initial withdrawal address (must be non-zero).
     */
    constructor(address token_, address withdrawalAddress_) {
        if (token_ == address(0)) revert ZeroAddress();
        if (token_.code.length == 0) revert InvalidToken();
        if (withdrawalAddress_ == address(0)) revert ZeroAddress();
        token = token_;
        admin = msg.sender;
        withdrawalAddress = withdrawalAddress_;
        emit AdminTransferred(address(0), msg.sender);
        emit WithdrawalAddressSet(withdrawalAddress_);
    }

    /**
     * @notice Propose a new admin. The proposed address must call acceptAdmin() to complete the transfer.
     * @dev Admin only. Reverts on zero address. Does not change admin until acceptAdmin() is called.
     * @param newAdmin The address being proposed as the new admin.
     */
    function proposeAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(admin, newAdmin);
    }

    /**
     * @notice Cancel a pending admin transfer proposal.
     * @dev Admin only. Clears pendingAdmin so the proposed address can no longer accept.
     */
    function cancelPendingAdmin() external onlyAdmin {
        address cancelled = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferCancelled(admin, cancelled);
    }

    /**
     * @notice Accept a pending admin transfer. Must be called by the pending admin.
     * @dev Reverts if the caller is not the pending admin. The `managers` mapping is
     *      intentionally not cleared on admin transfer — existing managers retain their
     *      role. After accepting, the new admin should audit prior `ManagerAdded` /
     *      `ManagerRemoved` events and call `removeManager` for any entries that should
     *      not carry over.
     */
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert OnlyPendingAdmin();
        address previousAdmin = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(previousAdmin, admin);
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

    /**
     * @notice Grant the manager role to an address.
     * @dev Admin only. Reverts on zero address.
     * @param manager The address to grant the manager role.
     */
    function addManager(address manager) external onlyAdmin {
        if (manager == address(0)) revert ZeroAddress();
        if (managers[manager]) return;
        managers[manager] = true;
        emit ManagerAdded(manager);
    }

    /**
     * @notice Revoke the manager role from an address.
     * @dev Admin only.
     * @param manager The address to revoke the manager role from.
     */
    function removeManager(address manager) external onlyAdmin {
        if (!managers[manager]) return;
        managers[manager] = false;
        emit ManagerRemoved(manager);
    }

    /**
     * @notice Deposit tokens into the portfolio. Deposited funds become unallocated.
     * @dev Any caller. Requires prior approval of at least `amount` on the token contract.
     * @param amount The number of tokens to deposit.
     */
    function deposit(uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Returns the unallocated token balance — funds held by this contract not yet routed to an envelope.
     */
    function unallocated() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Withdraw unallocated funds to the withdrawal address.
     * @dev Manager or admin. Reverts if `amount` exceeds the unallocated balance.
     * @param amount The number of tokens to withdraw.
     */
    function withdrawUnallocated(uint256 amount) external onlyManager {
        if (amount > unallocated()) revert InsufficientBalance();
        IERC20(token).safeTransfer(withdrawalAddress, amount);
        emit UnallocatedWithdrawn(amount);
    }

    /// @dev Reject ETH transfers — this contract is ERC-20 only.
    // slither-disable-next-line locked-ether
    receive() external payable {
        revert ETHNotAccepted();
    }
}

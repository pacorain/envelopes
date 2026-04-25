// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Envelope.sol";

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

    /// @notice Manager addresses. Admins implicitly have manager permissions.
    mapping(address => bool) public managers;

    /// @notice Deployed envelope contracts. Index is the envelope ID; address(0) means deleted.
    address[] public envelopes;

    error OnlyAdmin();
    error OnlyPendingAdmin();
    error OnlyManager();
    error ZeroAddress();
    error InvalidToken();
    error ETHNotAccepted();
    error InsufficientUnallocated();
    error EnvelopeNotFound();
    error EnvelopeNotEmpty();
    error SameEnvelope();

    event WithdrawalAddressSet(address indexed newWithdrawalAddress);
    event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event AdminTransferCancelled(address indexed admin, address indexed cancelledPendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);
    event Deposited(address indexed from, uint256 amount);
    event UnallocatedWithdrawn(uint256 amount);
    event EnvelopeCreated(uint256 indexed index, address indexed envelope, bytes32 name);
    event EnvelopeDeleted(uint256 indexed index);
    event Allocated(uint256 indexed index, uint256 amount);
    event FundsMoved(uint256 indexed from, uint256 indexed to, uint256 amount);
    event EnvelopeWithdrawn(uint256 indexed index, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyManager() {
        if (msg.sender != admin && !managers[msg.sender]) revert OnlyManager();
        _;
    }

    /// @notice Reject any ETH sent directly to this contract.
    // slither-disable-next-line locked-ether
    receive() external payable {
        revert ETHNotAccepted();
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

    // -------------------------------------------------------------------------
    // Admin transfer
    // -------------------------------------------------------------------------

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
     * @dev Reverts if the caller is not the pending admin.
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

    // -------------------------------------------------------------------------
    // Manager role
    // -------------------------------------------------------------------------

    /**
     * @notice Grant manager role to an address.
     * @dev Admin only.
     */
    function addManager(address manager) external onlyAdmin {
        managers[manager] = true;
        emit ManagerAdded(manager);
    }

    /**
     * @notice Revoke manager role from an address.
     * @dev Admin only.
     */
    function removeManager(address manager) external onlyAdmin {
        managers[manager] = false;
        emit ManagerRemoved(manager);
    }

    // -------------------------------------------------------------------------
    // Deposit and unallocated balance
    // -------------------------------------------------------------------------

    /**
     * @notice Pull tokens from the caller into this portfolio as unallocated funds.
     * @param amount Amount of tokens to deposit.
     */
    function deposit(uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Return the portfolio's unallocated token balance.
     * @dev Derived from the portfolio's own token balance. Allocated funds live in
     *      Envelope contracts at separate addresses and are not included here.
     */
    function unallocated() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Withdraw unallocated funds to the withdrawal address.
     * @dev Admin only. Reverts if amount exceeds unallocated balance.
     * @param amount Amount to withdraw.
     */
    function withdrawUnallocated(uint256 amount) external onlyAdmin {
        if (amount > unallocated()) revert InsufficientUnallocated();
        IERC20(token).safeTransfer(withdrawalAddress, amount);
        emit UnallocatedWithdrawn(amount);
    }

    // -------------------------------------------------------------------------
    // Envelope management
    // -------------------------------------------------------------------------

    /**
     * @notice Deploy a new Envelope and register it at the next available index.
     * @dev Manager only.
     * @param name A bytes32 identifier for the envelope (e.g. keccak256 of a string).
     * @return index The index assigned to the new envelope.
     */
    function createEnvelope(bytes32 name) external onlyManager returns (uint256 index) {
        Envelope envelope = new Envelope(address(this), IERC20(token), name);
        index = envelopes.length;
        envelopes.push(address(envelope));
        emit EnvelopeCreated(index, address(envelope), name);
    }

    /**
     * @notice Delete an envelope, setting its slot to address(0).
     * @dev Admin only. Reverts if the envelope still holds funds.
     * @param index The index of the envelope to delete.
     */
    function deleteEnvelope(uint256 index) external onlyAdmin {
        Envelope envelope = _getEnvelope(index);
        if (envelope.balance() != 0) revert EnvelopeNotEmpty();
        envelopes[index] = address(0);
        emit EnvelopeDeleted(index);
    }

    /**
     * @notice Move unallocated funds from the portfolio into an envelope.
     * @dev Manager only. Reverts if amount exceeds unallocated balance.
     * @param index  The destination envelope index.
     * @param amount Amount of tokens to allocate.
     */
    function allocate(uint256 index, uint256 amount) external onlyManager {
        address envelopeAddr = address(_getEnvelope(index));
        if (amount > unallocated()) revert InsufficientUnallocated();
        IERC20(token).safeTransfer(envelopeAddr, amount);
        emit Allocated(index, amount);
    }

    // -------------------------------------------------------------------------
    // Fund movement
    // -------------------------------------------------------------------------

    /**
     * @notice Move funds from one envelope to another.
     * @dev Manager only. Reverts if source and destination are the same.
     * @param from   Source envelope index.
     * @param to     Destination envelope index.
     * @param amount Amount of tokens to move.
     */
    function moveFunds(uint256 from, uint256 to, uint256 amount) external onlyManager {
        if (from == to) revert SameEnvelope();
        Envelope source = _getEnvelope(from);
        address dest = address(_getEnvelope(to));
        emit FundsMoved(from, to, amount);
        source.sendFunds(dest, amount);
    }

    /**
     * @notice Send funds from an envelope to the withdrawal address.
     * @dev Manager only. Funds can only leave to withdrawalAddress — this is a core
     *      security invariant of the Portfolio contract.
     * @param index  The envelope index to withdraw from.
     * @param amount Amount of tokens to withdraw.
     */
    function withdrawFromEnvelope(uint256 index, uint256 amount) external onlyManager {
        emit EnvelopeWithdrawn(index, amount);
        _getEnvelope(index).sendFunds(withdrawalAddress, amount);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieve a live Envelope by index, reverting for invalid or deleted slots.
     */
    function _getEnvelope(uint256 index) internal view returns (Envelope) {
        if (index >= envelopes.length || envelopes[index] == address(0)) revert EnvelopeNotFound();
        return Envelope(payable(envelopes[index]));
    }
}

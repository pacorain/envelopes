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

    /// @notice Addresses granted the manager role. Admins are implicitly managers.
    mapping(address => bool) public managers;

    /// @notice Deployed envelope contracts. Index is the envelope ID; address(0) means deleted.
    address[] public envelopes;

    error OnlyAdmin();
    error OnlyPendingAdmin();
    error OnlyManager();
    error ZeroAddress();
    error InvalidToken();
    error ETHNotAccepted();
    error InsufficientBalance();
    error EnvelopeNotFound();
    error EnvelopeNotEmpty();
    error SameEnvelope();

    event Deposited(address indexed from, uint256 amount);
    event UnallocatedWithdrawn(uint256 amount);
    event WithdrawalAddressSet(address indexed newWithdrawalAddress);
    event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event AdminTransferCancelled(address indexed admin, address indexed cancelledPendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);
    event EnvelopeCreated(uint256 indexed index, address envelope, bytes32 name);
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

    /**
     * @notice Deploy a new Envelope contract and register it in this portfolio.
     * @dev Manager only. Returns the index of the new envelope.
     * @param name A bytes32 identifier for the envelope (e.g. keccak256("mortgage")).
     */
    // slither-disable-next-line reentrancy-no-eth
    function createEnvelope(bytes32 name) external onlyManager returns (uint256) {
        address envelopeAddr = address(new Envelope(address(this), IERC20(token), name));
        uint256 index = envelopes.length;
        envelopes.push(envelopeAddr);
        emit EnvelopeCreated(index, envelopeAddr, name);
        return index;
    }

    /**
     * @notice Delete an envelope slot. The envelope must have a zero balance.
     * @dev Admin only. Sets the slot to address(0); index is not reused.
     * @param index The index of the envelope to delete.
     */
    // slither-disable-next-line reentrancy-no-eth
    function deleteEnvelope(uint256 index) external onlyAdmin {
        address envelopeAddr = _getEnvelope(index);
        if (Envelope(payable(envelopeAddr)).balance() > 0) revert EnvelopeNotEmpty();
        envelopes[index] = address(0);
        emit EnvelopeDeleted(index);
    }

    /**
     * @notice Move unallocated funds into an envelope.
     * @dev Manager only. Reverts if amount exceeds unallocated balance or envelope is invalid.
     * @param index  The target envelope index.
     * @param amount The number of tokens to allocate.
     */
    // slither-disable-next-line arbitrary-send-erc20
    function allocate(uint256 index, uint256 amount) external onlyManager {
        address envelopeAddr = _getEnvelope(index);
        if (amount > unallocated()) revert InsufficientBalance();
        IERC20(token).safeTransfer(envelopeAddr, amount);
        emit Allocated(index, amount);
    }

    /**
     * @notice Move funds from one envelope to another.
     * @dev Manager only. Reverts if either index is invalid, or if `from == to`.
     * @param from   Index of the source envelope.
     * @param to     Index of the destination envelope.
     * @param amount The number of tokens to move.
     */
    function moveFunds(uint256 from, uint256 to, uint256 amount) external onlyManager {
        if (from == to) revert SameEnvelope();
        address fromAddr = _getEnvelope(from);
        address toAddr = _getEnvelope(to);
        Envelope(fromAddr).sendFunds(toAddr, amount);
        emit FundsMoved(from, to, amount);
    }

    /**
     * @notice Withdraw funds from an envelope to the withdrawal address.
     * @dev Manager only. Funds leave to `withdrawalAddress` only — never an arbitrary address.
     * @param index  The index of the envelope to withdraw from.
     * @param amount The number of tokens to withdraw.
     */
    function withdrawFromEnvelope(uint256 index, uint256 amount) external onlyManager {
        address envelopeAddr = _getEnvelope(index);
        Envelope(envelopeAddr).sendFunds(withdrawalAddress, amount);
        emit EnvelopeWithdrawn(index, amount);
    }

    /// @dev Reject ETH transfers — this contract is ERC-20 only.
    // slither-disable-next-line locked-ether
    receive() external payable {
        revert ETHNotAccepted();
    }

    /// @dev Reverts with EnvelopeNotFound for out-of-bounds or deleted indices.
    function _getEnvelope(uint256 index) internal view returns (address) {
        if (index >= envelopes.length || envelopes[index] == address(0)) revert EnvelopeNotFound();
        return envelopes[index];
    }
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Envelope
 * @notice A minimal vault contract holding ERC-20 funds for a named allocation.
 *
 * Envelope is a dumb vault — it holds funds and exposes a transfer function,
 * but contains no role-based authorization logic. The only access check is that
 * `sendFunds` is callable only by the Portfolio contract that deployed this envelope.
 * All higher-level permission logic (admin vs manager roles, etc.) lives in Portfolio.sol.
 */
contract Envelope {
    using SafeERC20 for IERC20;

    /// @notice The Portfolio contract that deployed this envelope and is the sole authorized caller.
    address public immutable portfolio;

    /// @notice The ERC-20 token this envelope holds.
    IERC20 public immutable token;

    /// @notice The envelope's identifier.
    bytes32 public immutable name;

    error OnlyPortfolio();
    error ZeroAddress();
    error ETHNotAccepted();
    error CannotRescuePrimaryToken();

    /// @notice Reject any ETH sent directly to this contract.
    // slither-disable-next-line locked-ether
    receive() external payable {
        revert ETHNotAccepted();
    }

    modifier onlyPortfolio() {
        if (msg.sender != portfolio) revert OnlyPortfolio();
        _;
    }

    constructor(address portfolio_, IERC20 token_, bytes32 name_) {
        if (portfolio_ == address(0)) revert ZeroAddress();
        portfolio = portfolio_;
        token = token_;
        name = name_;
    }

    /**
     * @notice Transfer tokens out of this envelope to another address.
     * @dev Callable only by the Portfolio. Used to move funds to another envelope
     *      or to the withdrawal address.
     * @param to      Destination address (another envelope or withdrawal address).
     * @param amount  Amount of tokens to transfer.
     */
    // slither-disable-next-line arbitrary-send-erc20
    function sendFunds(address to, uint256 amount) external onlyPortfolio {
        token.safeTransfer(to, amount);
    }

    /**
     * @notice Recover ERC-20 tokens accidentally sent to this envelope.
     * @dev Callable only by the Portfolio. Cannot be used to rescue the primary token —
     *      use sendFunds() for that. Intended for tokens mistakenly sent to this address.
     * @param rescueToken_  The ERC-20 token to recover (must not be the primary token).
     * @param to            Destination address.
     * @param amount        Amount to transfer.
     */
    // slither-disable-next-line arbitrary-send-erc20
    function rescueToken(IERC20 rescueToken_, address to, uint256 amount) external onlyPortfolio {
        if (address(rescueToken_) == address(token)) revert CannotRescuePrimaryToken();
        rescueToken_.safeTransfer(to, amount);
    }

    /**
     * @notice Return the current token balance of this envelope.
     */
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}

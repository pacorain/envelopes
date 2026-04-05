// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Envelope
 * @notice A minimal vault contract holding ERC-20 funds for a named allocation.
 *
 * Envelope is a dumb vault — it holds funds and exposes a transfer function,
 * but contains no role-based authorization logic. The only access check is that
 * `transfer` is callable only by the Portfolio contract that deployed this envelope.
 * All higher-level permission logic (admin vs manager roles, etc.) lives in Portfolio.sol.
 */
contract Envelope {
    /// @notice The Portfolio contract that deployed this envelope and is the sole authorized caller.
    address public immutable portfolio;

    /// @notice The ERC-20 token this envelope holds.
    IERC20 public immutable token;

    /// @notice The envelope's identifier.
    bytes32 public immutable name;

    error OnlyPortfolio();

    modifier onlyPortfolio() {
        if (msg.sender != portfolio) revert OnlyPortfolio();
        _;
    }

    constructor(address portfolio_, IERC20 token_, bytes32 name_) {
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
    function transfer(address to, uint256 amount) external onlyPortfolio {
        token.transfer(to, amount);
    }

    /**
     * @notice Return the current token balance of this envelope.
     */
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}

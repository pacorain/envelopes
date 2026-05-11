// ABI for Portfolio.sol (v1 full implementation from PR #36 + #39)
export const PortfolioABI = [
  // State variables
  'function token() view returns (address)',
  'function admin() view returns (address)',
  'function pendingAdmin() view returns (address)',
  'function withdrawalAddress() view returns (address)',
  'function managers(address) view returns (bool)',
  'function envelopes(uint256) view returns (address)',

  // Admin: view
  'function unallocated() view returns (uint256)',

  // Admin: transfer
  'function proposeAdmin(address newAdmin)',
  'function cancelPendingAdmin()',
  'function acceptAdmin()',
  'function setWithdrawalAddress(address newWithdrawalAddress)',

  // Admin: managers
  'function addManager(address manager)',
  'function removeManager(address manager)',

  // Admin: funds
  'function withdrawUnallocated(uint256 amount)',
  'function deleteEnvelope(uint256 index)',
  'function rescueTokenFromEnvelope(uint256 index, address rescueToken_, uint256 amount)',

  // Manager: funds
  'function deposit(uint256 amount)',
  'function createEnvelope(bytes32 name) returns (uint256)',
  'function allocate(uint256 index, uint256 amount)',
  'function moveFunds(uint256 from, uint256 to, uint256 amount)',
  'function withdrawFromEnvelope(uint256 index, uint256 amount)',

  // Events
  'event Deposited(address indexed from, uint256 amount)',
  'event UnallocatedWithdrawn(uint256 amount)',
  'event WithdrawalAddressSet(address indexed newWithdrawalAddress)',
  'event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin)',
  'event AdminTransferCancelled(address indexed admin, address indexed cancelledPendingAdmin)',
  'event AdminTransferred(address indexed previousAdmin, address indexed newAdmin)',
  'event ManagerAdded(address indexed manager)',
  'event ManagerRemoved(address indexed manager)',
  'event EnvelopeCreated(uint256 indexed index, address envelope, bytes32 name)',
  'event EnvelopeDeleted(uint256 indexed index)',
  'event Allocated(uint256 indexed index, uint256 amount)',
  'event FundsMoved(uint256 indexed from, uint256 indexed to, uint256 amount)',
  'event EnvelopeWithdrawn(uint256 indexed index, uint256 amount)',
  'event TokenRescued(uint256 indexed index, address indexed rescueToken, uint256 amount)',

  // Custom errors
  'error OnlyAdmin()',
  'error OnlyPendingAdmin()',
  'error OnlyManager()',
  'error ZeroAddress()',
  'error InvalidToken()',
  'error ETHNotAccepted()',
  'error InsufficientUnallocated()',
  'error InsufficientEnvelopeBalance()',
  'error EnvelopeNotFound()',
  'error EnvelopeNotEmpty()',
  'error SameEnvelope()',
  'error NoPendingAdminProposal()',
  'error NotAManager()',
  'error AlreadyManager()',
  'error CannotRescuePrimaryToken()',
];

// Minimal ERC-20 ABI (for USDC approval)
export const ERC20ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Portfolio.sol is a stub at the time of writing. This ABI follows the
// documented interface in README.md and docs/frontend-plan.md. Regenerate from
// the compiled artifact once the contract is implemented.
export const PortfolioABI = [
  "function admin() view returns (address)",
  "function withdrawalAddress() view returns (address)",
  "function token() view returns (address)",
  "function unallocated() view returns (uint256)",
  "function envelopeList() view returns (bytes32[])",
  "function envelopes(bytes32) view returns (address)",
  "function isManager(address) view returns (bool)",
  "function managerList() view returns (address[])",

  "function deposit(uint256 amount)",
  "function allocate(bytes32 name, uint256 amount)",
  "function move(bytes32 from, bytes32 to, uint256 amount)",
  "function sendToWithdrawal(bytes32 envelope, uint256 amount)",
  "function withdraw(uint256 amount)",
  "function createEnvelope(bytes32 name) returns (address)",

  "function setWithdrawalAddress(address addr)",
  "function addManager(address addr)",
  "function removeManager(address addr)",
  "function transferAdmin(address newAdmin)",

  "event EnvelopeCreated(bytes32 indexed name, address envelope)",
  "event ManagerAdded(address indexed manager)",
  "event ManagerRemoved(address indexed manager)",
  "event WithdrawalAddressChanged(address indexed previous, address indexed next)",
  "event AdminTransferred(address indexed previous, address indexed next)",
];

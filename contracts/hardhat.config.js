import HardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  plugins: [HardhatToolboxMochaEthers],
  solidity: "0.8.34",
  networks: {
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;

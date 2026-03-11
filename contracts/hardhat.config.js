require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ganache: {
      url: process.env.ETH_RPC_URL || "http://127.0.0.1:7545",
      chainId: 5777,
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  },
};

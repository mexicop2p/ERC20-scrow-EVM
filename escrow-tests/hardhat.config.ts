import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const ALCHEMY_ARB_RPC = process.env.ARB_MAINNET_RPC!;   // e.g. https://arb-mainnet.g.alchemy.com/v2/KEY
const FUNDED_PK       = process.env.FUNDED_PRIVATE_KEY!; // never commit 👀

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arbitrum: {
      url: ALCHEMY_ARB_RPC,
      accounts: [FUNDED_PK],
      chainId: 42161,
    },
    hardhat: {
      forking: {
        url: ALCHEMY_ARB_RPC,
        blockNumber: 199000000,      // optional pin
      },
    },
  },
};

export default config;

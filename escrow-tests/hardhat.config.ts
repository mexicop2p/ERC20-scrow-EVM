import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();


export default {
  solidity: "0.8.24",
  networks: {
    arbitrum: {
      url: process.env.ARB_MAINNET_RPC,
      chainId: 42161,
      accounts: [
        process.env.DEPLOYER_PK!,   // owner / proofSigner  // buyer
      ],
    },
  },
  
  
  etherscan: {
    apiKey: process.env.ARBISCAN_KEY        // ← single key for Etherscan v2
  },
  // optional: keep Sourcify icon
  sourcify: { enabled: true },
} as const;

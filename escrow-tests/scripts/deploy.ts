import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const proofSigner = await deployer.getAddress();          // same key
  const maxLock     = 3600;                                 // 1 h
  const kycLimit    = ethers.parseUnits("32400", 6);        // 32 400 MXNB

  const Escrow = await ethers.getContractFactory("P2PEscrow");
  const esc    = await Escrow.deploy(proofSigner, maxLock, kycLimit);
  await esc.waitForDeployment();

  console.log("✅  Escrow deployed →", await esc.getAddress());
}

main().catch(console.error);

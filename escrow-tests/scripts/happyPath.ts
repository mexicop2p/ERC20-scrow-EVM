// scripts/happyPath.ts
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

/* ───── user-supplied constants ─────────────────────────────────────── */
const ESC  = "0x912e4A1cb08817a9E0a2F56894a3cA2f1ad7d06a";             // escrow
const MXNB = "0xF197FFC28c23E0309B5559e7a166f2c6164C80aA";             // MXNB
const ORDER_ID = ethers.keccak256(ethers.toUtf8Bytes("demo-script-001"));
const AMT      = ethers.parseUnits("1", 6);                            // 1 MXNB
/* ───────────────────────────────────────────────────────────────────── */

async function main() {
  /* 0. handles & signer (single key for all roles) */
  const [wallet] = await ethers.getSigners();
  const esc  = await ethers.getContractAt("P2PEscrow", ESC);
  const mxnb = await ethers.getContractAt("IERC20",   MXNB);

  console.log("Using wallet:", wallet.address);

  /* 1. whitelist already enabled on-chain; skip if not
     // await esc.setWhitelistEnabled(true);
     // await esc.whitelistToken(MXNB, true);
  */

  /* 2. approve & deposit */
  console.log("→ approve 1 MXNB");
  await (await mxnb.approve(ESC, AMT)).wait();

  console.log("→ deposit order", ORDER_ID);
  await (await esc.deposit(ORDER_ID, AMT, MXNB)).wait();

  /* 3. lock (same wallet acts as buyer) */
  console.log("→ lock order");
  await (await esc.lockOrder(ORDER_ID, 300)).wait();           // 5 min lock

  /* 4. backend proof (wallet == proofSigner) */
  const digest = ethers.solidityPackedKeccak256(
    ["bytes32","address","uint128","address"],
    [ORDER_ID, wallet.address, AMT, MXNB]
  );
  const sig = await wallet.signMessage(ethers.getBytes(digest));

  /* 5. release */
  console.log("→ release");
  await (await esc.release(ORDER_ID, sig)).wait();

  console.log("✔  Happy-path completed - check Arbiscan!");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

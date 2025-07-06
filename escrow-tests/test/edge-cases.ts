/* test/edge-cases.ts */

import { expect } from "chai";
import { ethers } from "hardhat";

describe("P2PEscrow – edge cases", () => {
  let esc: any, mxnb: any, seller: any, buyer: any;

  beforeEach(async () => {
    [seller, buyer] = await ethers.getSigners();
  
    // ───── 1. deploy a fresh MockERC20 — name, symbol, decimals ─────
    const Mock = await ethers.getContractFactory("MockERC20");
    mxnb = await Mock.deploy("USD Coin", "USDC", 6);
    await mxnb.mint(seller.address, ethers.parseUnits("10", 6));
  
    // ───── 2. deploy a fresh escrow (isolated) ─────
    const Escrow  = await ethers.getContractFactory("P2PEscrow");
    esc = await Escrow.deploy(
      seller.address,                    // proofSigner
      3600,                              // MAX_LOCK_DURATION
      ethers.parseUnits("32400", 6)      // KYC limit (token units)
    );
  
    // ───── 3. enable whitelist & add the mock token ─────
    await esc.setWhitelistEnabled(true);
    await esc.whitelistToken(mxnb.target, true);
  });
  

  it("reverts on duplicate order IDs", async () => {
    const id  = ethers.keccak256(ethers.toUtf8Bytes("dup-id"));
    const amt = ethers.parseUnits("1", 6);
    await mxnb.connect(seller).approve(esc.target, amt);
    await esc .connect(seller).deposit(id, amt, mxnb.target);

    await expect(
      esc.connect(seller).deposit(id, amt, mxnb.target)
    ).to.be.revertedWithCustomError(esc, "OrderExists");
  });

  it("blocks lock duration > MAX_LOCK_DURATION", async () => {
    const id  = ethers.keccak256(ethers.toUtf8Bytes("lock-too-long"));
    const amt = ethers.parseUnits("1", 6);
    await mxnb.connect(seller).approve(esc.target, amt);
    await esc .connect(seller).deposit(id, amt, mxnb.target);

    const max = await esc.MAX_LOCK_DURATION();
    await expect(
      esc.connect(buyer).lockOrder(id, Number(max) + 1)
    ).to.be.revertedWithCustomError(esc, "LockTooLong");
  });

  it("rejects release with wrong signer", async () => {
    const id  = ethers.keccak256(ethers.toUtf8Bytes("bad-sig"));
    const amt = ethers.parseUnits("1", 6);
    await mxnb.connect(seller).approve(esc.target, amt);
    await esc .connect(seller).deposit(id, amt, mxnb.target);
    await esc .connect(buyer).lockOrder(id, 60);

    // digest signed by buyer instead of proofSigner
    const digest = ethers.solidityPackedKeccak256(
      ["bytes32","address","uint128","address"],
      [id, buyer.address, amt, mxnb.target]
    );
    const badSig = await buyer.signMessage(ethers.getBytes(digest));

    await expect(
      esc.release(id, badSig)
    ).to.be.revertedWithCustomError(esc, "SignatureInvalid");
  });
});

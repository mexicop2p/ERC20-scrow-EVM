import { ethers, network } from "hardhat";
import { expect } from "chai";

/* ────────────────────────── helpers ─────────────────────────── */

async function signProof(
  backend: any,
  id: string,
  buyer: string,
  amt: bigint,
  token: string
) {
  const digest = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "uint128", "address"],
    [id, buyer, amt, token]
  );
  return backend.signMessage(ethers.getBytes(digest));
}

/* ────────────────────────── test suite ──────────────────────── */

describe("P2PEscrow", function () {
  this.timeout(0); // disable 40 s Mocha cap

  let escrow: any, usdc: any;
  let seller: any, buyer: any, other: any, backend: any;
  const MXN_LIMIT = ethers.parseUnits("2400", 6);
  const MAX_LOCK = 600;

  beforeEach(async () => {
    [seller, buyer, other, backend] = await ethers.getSigners();

    /* mock USDC */
    const Mock = await ethers.getContractFactory("MockERC20");
    usdc = await Mock.deploy("USD Coin", "USDC", 6);
    await usdc.mint(seller.address, ethers.parseUnits("5", 6));

    /* deploy escrow */
    const Escrow = await ethers.getContractFactory("P2PEscrow");
    escrow = await Escrow.deploy(backend.address, MAX_LOCK, MXN_LIMIT);

    /* approve */
    await usdc
      .connect(seller)
      .approve(await escrow.getAddress(), ethers.parseUnits("5", 6));
  });

  /* ── happy path ────────────────────────────────────────────── */
  it("deposit → lock → release (happy path)", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
    const amt = ethers.parseUnits("1", 6);

    await expect(escrow.connect(seller).deposit(id, amt, await usdc.getAddress()))
      .to.emit(escrow, "OrderCreated");

    await expect(escrow.connect(buyer).lockOrder(id, 300))
      .to.emit(escrow, "OrderLocked");

    const sig = await signProof(
      backend,
      id,
      buyer.address,
      amt,
      await usdc.getAddress()
    );
    await expect(escrow.release(id, sig)).to.emit(escrow, "OrderReleased");

    expect(await usdc.balanceOf(buyer.address)).to.equal(amt);
  });

  /* ── deposit edge-cases ────────────────────────────────────── */
  it("rejects zero, over-limit, & duplicate deposits", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("dup"));
    const amt = ethers.parseUnits("1", 6);
    const over = ethers.parseUnits("3000", 6);

    await expect(
      escrow.connect(seller).deposit(id, 0, usdc)
    ).to.be.revertedWithCustomError(escrow, "ZeroAmount");

    await expect(
      escrow.connect(seller).deposit(id, over, usdc)
    ).to.be.revertedWithCustomError(escrow, "KycLimit");

    await escrow.connect(seller).deposit(id, amt, usdc);
    await expect(
      escrow.connect(seller).deposit(id, amt, usdc)
    ).to.be.revertedWithCustomError(escrow, "OrderExists");
  });

  /* ── lock-order edge cases ─────────────────────────────────── */
  it("enforces lock duration and single buyer", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("lock"));
    const amt = ethers.parseUnits("1", 6);
    await escrow.connect(seller).deposit(id, amt, usdc);

    await expect(
      escrow.connect(buyer).lockOrder(id, MAX_LOCK + 1)
    ).to.be.revertedWithCustomError(escrow, "LockTooLong");

    await escrow.connect(buyer).lockOrder(id, 60);
    await expect(
      escrow.connect(other).lockOrder(id, 30)
    ).to.be.revertedWithCustomError(escrow, "AlreadyLocked");
  });

  /* ── refund flow ───────────────────────────────────────────── */
  it("refunds seller if lock expired or order never locked", async () => {
    const amt = ethers.parseUnits("1", 6);

    // Available → refund
    const id1 = ethers.keccak256(ethers.toUtf8Bytes("r1"));
    await escrow.connect(seller).deposit(id1, amt, usdc);
    await expect(escrow.connect(seller).refund(id1)).to.emit(
      escrow,
      "OrderRefunded"
    );

    // Locked → wait expiry → refund
    const id2 = ethers.keccak256(ethers.toUtf8Bytes("r2"));
    await escrow.connect(seller).deposit(id2, amt, usdc);
    await escrow.connect(buyer).lockOrder(id2, 5);

    await network.provider.send("evm_increaseTime", [10]);
    await expect(escrow.connect(seller).refund(id2)).to.emit(
      escrow,
      "OrderRefunded"
    );
  });

  /* ── signature checks ──────────────────────────────────────── */
  it("rejects wrong signer & handles replay as OrderNotFound", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("sig"));
    const amt = ethers.parseUnits("1", 6);

    await escrow.connect(seller).deposit(id, amt, usdc);
    await escrow.connect(buyer).lockOrder(id, 300);

    const badSig = await other.signMessage(
      ethers.getBytes(
        ethers.solidityPackedKeccak256(
          ["bytes32", "address", "uint128", "address"],
          [id, buyer.address, amt, await usdc.getAddress()]
        )
      )
    );
    await expect(escrow.release(id, badSig)).to.be.revertedWithCustomError(
      escrow,
      "SignatureInvalid"
    );

    const sig = await signProof(
      backend,
      id,
      buyer.address,
      amt,
      await usdc.getAddress()
    );
    await escrow.release(id, sig); // first succeeds

    // second call hits deleted order
    await expect(escrow.release(id, sig)).to.be.revertedWithCustomError(
      escrow,
      "OrderNotFound"
    );
  });

  /* ── whitelist toggle ──────────────────────────────────────── */
  it("enforces token whitelist when enabled", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("wl"));
    const amt = ethers.parseUnits("1", 6);

    await escrow.setWhitelistEnabled(true);
    await expect(
      escrow.connect(seller).deposit(id, amt, usdc)
    ).to.be.revertedWithCustomError(escrow, "TokenNotAllowed");

    await escrow.whitelistToken(await usdc.getAddress(), true);
    await expect(escrow.connect(seller).deposit(id, amt, usdc)).to.emit(
      escrow,
      "OrderCreated"
    );
  });

  /* ── access-control guards ─────────────────────────────────── */
  it("only seller can refund; only owner can update signer", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("ac"));
    const amt = ethers.parseUnits("1", 6);
    await escrow.connect(seller).deposit(id, amt, usdc);

    await expect(escrow.connect(buyer).refund(id)).to.be.revertedWithCustomError(
      escrow,
      "NotSeller"
    );

    await expect(
      escrow.connect(buyer).updateProofSigner(buyer.address)
    ).to.be.revertedWithCustomError(
      escrow,
      "OwnableUnauthorizedAccount"
    );

    await escrow.connect(seller).refund(id); // succeeds
  });
});

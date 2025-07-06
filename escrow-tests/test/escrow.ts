import { ethers, network } from "hardhat";
import { expect } from "chai";

describe("P2PEscrow – happy path", () => {
  const MAX_LOCK = 3600;                // 1 h
  const KYC_LIM  = ethers.parseUnits("2400", 6); // assume USDC (6 dec)

  let usdc: any;        // mock USDC on fork
  let escrow: any;
  let seller: any, buyer: any, backend: any;

  beforeEach(async () => {
    [seller, buyer, backend] = await ethers.getSigners();

    // get real USDC proxy on Arbitrum fork
    usdc = await ethers.getContractAt(
      "IERC20",
      "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8" // USDC.e
    );

    // fund seller with USDC via impersonation
    const whale = "0x4C8eE9cCb8BDF3d8c29eb55239CcF04065aBEf3A";
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [whale]});
    const whaleSigner = await ethers.getSigner(whale);
    const tenK = ethers.parseUnits("10000", 6);
    await usdc.connect(whaleSigner).transfer(seller.address, tenK);

    // deploy escrow
    const Escrow = await ethers.getContractFactory("P2PEscrow");
    escrow = await Escrow.deploy(backend.address, MAX_LOCK, KYC_LIM);

    // seller approve
    await usdc.connect(seller).approve(escrow.getAddress(), tenK);
  });

  it("deposit → lock → release", async () => {
    const id = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
    const amt = ethers.parseUnits("100", 6);

    // deposit
    await expect(escrow.connect(seller).deposit(id, amt, usdc.getAddress()))
      .to.emit(escrow, "OrderCreated");

    // lock
    await expect(escrow.connect(buyer).lockOrder(id, 600))
      .to.emit(escrow, "OrderLocked");

    // craft backend proof
    const hash = ethers.solidityPackedKeccak256(
      ["bytes32","address","uint128","address"],
      [id, buyer.address, amt, usdc.getAddress()]
    );
    const digest = ethers.hashMessage(hash);
    const sig = await backend.signMessage(ethers.getBytes(hash)); // same as digest

    // release
    await expect(escrow.release(id, sig))
      .to.emit(escrow, "OrderReleased");

    // balances
    expect(await usdc.balanceOf(buyer.address)).to.equal(amt);
    expect(await usdc.balanceOf(escrow.getAddress())).to.equal(0n);
  });
});

# 📦 P2PEscrow – Test Suite

## How to run

```bash
# 1. install deps
npm install

# 2. run entire suite (Hardhat in-memory network)
npx hardhat clean && npx hardhat test
````

No RPC key needed – all tests use the default Hardhat chain and a
mint-on-the-fly mock stable-coin.

---

## File overview

| File        | What it covers                                                         | Key assertions                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `escrow.ts` | **End-to-end & edge cases** for `P2PEscrow` using a `MockERC20` token. | *Happy path*: seller deposits → buyer locks → backend signature releases tokens.<br>*Deposit guards*: zero amount, KYC limit, duplicate ID.<br>*Lock guards*: duration > max, double-locking.<br>*Refund paths*: immediate refund, refund after lock expiry.<br>*Signature checks*: wrong signer, replay after order deletion.<br>*Whitelist toggle*: deposit rejected/allowed based on owner settings.<br>*Access control*: only seller can refund, only owner can change proof-signer. |

---

## Detailed walkthrough of `escrow.ts`

### 1. **Bootstrapping**

```typescript
const Mock = await ethers.getContractFactory("MockERC20");
usdc = await Mock.deploy("USD Coin", "USDC", 6);
await usdc.mint(seller, 5e6);  // 5 USDC (6-dec)
```

*Creates a token we fully control, so tests don’t rely on main-net forks.*

---

### 2. **Happy path**

1. Seller `deposit`s 1 USDC.
2. Buyer `lock`s for 5 min.
3. Backend signs `(id,buyer,amount,token)`.
4. `release` transfers funds → buyer.

*Proves the golden flow and that balances line up.*

---

### 3. **Deposit guards**

*Zero amount*, *over KYC*, and *duplicate ID* each revert with their custom error.
Guarantees bad data never hits storage.

---

### 4. **Lock-order guards**

*LockTooLong* & *AlreadyLocked* show the buyer can’t grief by over-locking
or double-locking.

---

### 5. **Refund logic**

*Case A* – order never locked → immediate refund.
*Case B* – locked but expired (using `evm_increaseTime`) → refund.

Confirms the seller can always reclaim funds.

---

### 6. **Signature protection**

*Wrong signer* must revert `SignatureInvalid`.
*Replay* after successful release now reverts `OrderNotFound`
because the struct is deleted, proving the replay window is closed.

---

### 7. **Whitelist toggle**

Owner turns whitelist **on** → deposit rejected.
Adds token → deposit succeeds.
Ensures compliance controls work.

---

### 8. **Access-control**

*Non-seller refund* → `NotSeller`.
*Non-owner update signer* → `OwnableUnauthorizedAccount`.

Shows critical admin functions are locked down.

---

## Extending the suite

* `invariant.spec.ts` – fuzz random sequences and check total escrowed == contract balance.
* `fork.spec.ts` – run a single deposit/refund on a main-net fork with real USDC.e.
* `gasReporter.json` – snapshot gas per function; fail CI on >10 % change.

Pull requests should add or update tests whenever contract logic changes.

```

---

### Next actions you could take

1. **Parameterise** the KYC limit per token (deploy separate escrows or store a mapping).  
2. **Add the optional tests** above when you approach audit time.  
3. **Finish the deployment script** and try it on Arbitrum testnet with MXNB once the token is live.

Ping me for any of those and I’ll help you wire them up. 🚀

# P2PEscrow: Peer-to-Peer Token-for-Fiat Escrow Smart Contract

## Overview

**P2PEscrow** is a trust-minimized escrow smart contract designed for peer-to-peer (P2P) trades where users exchange ERC-20 tokens (e.g., USDC) for fiat currency (e.g., MXN via SPEI bank transfer). The contract enforces an amount ceiling per transaction, aligning with Mexico's latest anti-money laundering (AML) regulations as of June 2025.

**Lifecycle:**  
1. **Deposit:** Seller escrows ERC-20 tokens (optionally whitelisted).
2. **Lock:** Buyer locks the order and sends fiat off-chain.
3. **Release:** Backend verifies fiat payment and signs a proof; anyone can release tokens to the buyer.
4. **Refund:** If unpaid or lock expires, seller can reclaim tokens.

## Features

- **Amount Limit Enforcement:** Hard cap per order (`MXN_KYC_LIMIT`) to comply with AML thresholds.
- **Token Whitelisting:** Optional whitelist for allowed ERC-20 tokens.
- **Replay Protection:** Prevents double-spending of backend payment proofs.
- **Gas Optimizations:** Packed structs, storage refunds, and custom error types.
- **Modular Access Control:** Owner can manage backend signer and token whitelist.

---

## Smart Contract Details

### Constructor

```
constructor(address _proofSigner, uint256 _maxLockSecs, uint256 _kycLimit)
```
- `_proofSigner`: Address authorized to sign off-chain fiat payment proofs.
- `_maxLockSecs`: Maximum order lock duration (seconds).
- `_kycLimit`: Maximum allowed deposit per order (in token units, set to 32,400 MXN for compliance).

### Core Functions

- `deposit(bytes32 id, uint128 amount, address token)`:  
  Seller deposits tokens into escrow. Enforces:
  - Unique order ID.
  - Amount > 0 and ≤ `MXN_KYC_LIMIT`.
  - Token whitelisting (if enabled).

- `lockOrder(bytes32 id, uint64 duration)`:  
  Buyer locks an available order for a specified duration (≤ `MAX_LOCK_DURATION`).

- `release(bytes32 id, bytes calldata sig)`:  
  Anyone can release tokens to the buyer upon valid backend-signed proof of fiat payment.

- `refund(bytes32 id)`:  
  Seller can reclaim tokens if order is not completed or lock expires.

- Owner functions for managing backend signer, whitelist, and allowed tokens.

### Events

- `OrderCreated`, `OrderLocked`, `OrderReleased`, `OrderRefunded`
- `ProofSignerUpdated`, `ProofConsumed`, `TokenWhitelistSet`

---

## Compliance with Mexican AML Law (as of June 2025)

### Legal Context

- **Threshold:**  
  The latest AML reforms (LFPIORPI, June 2025) require that virtual asset service providers (VASPs) enforce KYC and transaction monitoring for all users, with enhanced reporting for transactions above **645 UMA** (~72,978 MXN in 2025).  
  This contract sets the per-order limit at **32,400 MXN**, well below the reporting threshold, to minimize compliance burden and risk.

- **KYC Enforcement:**  
  While the contract enforces an on-chain per-order cap, KYC and transaction monitoring must be implemented off-chain by the platform operator.

### How the Contract Enforces Compliance

- **Hard Amount Cap:**  
  The `MXN_KYC_LIMIT` variable is set to 32,400 MXN, enforced in the `deposit` function. Any deposit above this limit is rejected (`KycLimit()` error).
- **Order Uniqueness:**  
  Prevents order reuse and replay attacks.
- **Token Whitelisting:**  
  Allows the operator to restrict escrow to approved stablecoins or tokens, reducing risk.
- **Backend Proofs:**  
  Off-chain verification of fiat payments ensures that only legitimate trades are settled on-chain.

### Why This Matters

- **Reduces AML Risk:**  
  By capping the maximum value per transaction, the contract helps ensure that individual trades do not trigger mandatory reporting thresholds under Mexican law.
- **Supports KYC Policy:**  
  The limit encourages platforms to collect KYC information for all users, and to apply enhanced due diligence off-chain for any user attempting to circumvent limits.

---

## Example Usage

1. **Seller** approves tokens and calls `deposit`.
2. **Buyer** locks the order and sends MXN via SPEI.
3. **Backend** verifies fiat receipt and signs a release proof.
4. **Anyone** can call `release` with the backend signature to complete the trade.
5. **If expired/unpaid**, seller can call `refund` to reclaim tokens.

---

## Security Considerations

- **Reentrancy:**  
  All state-changing functions are protected by `nonReentrant`.
- **Signature Verification:**  
  Only the designated backend signer can authorize releases.
- **Replay Protection:**  
  Used proofs are tracked and cannot be reused.
- **Order Deletion:**  
  Orders are deleted after completion or refund to save gas and prevent reuse.

---

## Limitations & Warnings

> **This contract is for educational purposes only.**

- **On-chain enforcement is limited to per-order amount caps and token controls.**  
  Full AML compliance—including KYC, transaction monitoring, and suspicious activity reporting—must be implemented off-chain by the platform operator.
- **Thresholds and laws may change.**  
  The `MXN_KYC_LIMIT` must be updated as Mexican law and UMA values evolve.
- **This contract does not prevent structuring (splitting transactions to avoid limits).**  
  Operators must monitor user behavior off-chain to detect and prevent such activity.
- **No on-chain identity verification.**  
  All KYC and user verification must be handled by the platform.

---

## Disclaimer

This contract is **not a substitute for legal compliance**.  
Operating a crypto escrow service in Mexico requires registration, robust KYC/AML programs, and ongoing legal review.  
**Use at your own risk.**

---

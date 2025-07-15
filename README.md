# MexicoP2PEscrow: Peer-to-Peer Token-for-Fiat Escrow Smart Contract

[SMART CONTRACT ADDRESS]https://arbiscan.io/address/0x912e4A1cb08817a9E0a2F56894a3cA2f1ad7d06a#tokentxns 

## Overview

**P2PEscrow** is a trust-minimized escrow smart contract designed for peer-to-peer (P2P) trades where users exchange ERC-20 tokens (e.g., USDC) for fiat currency (e.g., MXN via [SPEI](https://www.banxico.org.mx/cep/)). The contract enforces an amount ceiling per transaction, aligning with Mexico's latest [anti-money laundering (AML)](https://www.dof.gob.mx/nota_detalle.php?codigo=5273191&fecha=17/10/2012#gsc.tab=0) regulations as of June 2025.

**Lifecycle:**  
1. **Deposit:** Seller escrows ERC-20 tokens (optionally whitelisted).
2. **Lock:** Buyer locks the order and sends fiat off-chain.
3. **Release:** Backend verifies fiat payment and signs a proof; anyone can release tokens to the buyer.
4. **Refund:** If unpaid or lock expires, seller can reclaim tokens.

---

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
  The latest AML reforms ([LFPIORPI](https://www.gob.mx/cnbv/acciones-y-programas/ley-federal-para-la-prevencion-e-identificacion-de-operaciones-con-recursos-de-procedencia-ilicita), June 2025) require that virtual asset service providers (VASPs) enforce KYC and transaction monitoring for all users, with enhanced reporting for transactions above **645 UMA** (~72,978 MXN in 2025).  
  This contract sets the per-order limit at **32,400 MXN**, well below the reporting threshold, to minimize compliance burden and risk.

  - [UMA Value 2025](https://www.gob.mx/inegi/acciones-y-programas/uma-2025): 1 UMA = 113.14 MXN
  - [Threshold Reference](https://prevenet.com.mx/uma-2025/): 645 UMA = 72,978 MXN

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
2. **Buyer** locks the order and sends MXN via [SPEI](https://www.banxico.org.mx/cep/).
3. **Backend** verifies fiat receipt and signs a release proof.
4. **Anyone** can call `release` with the backend signature to complete the trade.
5. **If expired/unpaid**, seller can call `refund` to reclaim tokens.

---

## Security Considerations

- **Reentrancy:**  
  All state-changing functions are protected by [`nonReentrant`](https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard).
- **Signature Verification:**  
  Only the designated backend signer can authorize releases ([ECDSA](https://docs.openzeppelin.com/contracts/4.x/api/utils#ECDSA)).
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

## References

- [Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI)](https://www.gob.mx/cnbv/acciones-y-programas/ley-federal-para-la-prevencion-e-identificacion-de-operaciones-con-recursos-de-procedencia-ilicita)
- [UMA Value 2025 (INEGI)](https://www.gob.mx/inegi/acciones-y-programas/uma-2025)
- [Threshold Reference (Prevenet)](https://prevenet.com.mx/uma-2025/)
- [OpenZeppelin Contracts Documentation](https://docs.openzeppelin.com/contracts/4.x/)
- [SPEI - Banco de México](https://www.banxico.org.mx/cep/)
- [Crypto AML Compliance in Mexico (BGBG Abogados)](https://bgbg.mx/en/the-future-of-crypto-in-mexico-regulation-compliance-and-opportunity/)
- [AML/CFT Reforms June 2025 (ZIGRAM)](https://zigram.tech/blog/aml-cft-reforms-mexico-2025/)

---

## Disclaimer

This contract is **not a substitute for legal compliance**.  
Operating a crypto escrow service in Mexico requires registration, robust KYC/AML programs, and ongoing legal review.  
**Use at your own risk.**

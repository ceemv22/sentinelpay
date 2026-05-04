<p align="center">
  <img src="api/public/logo.svg" alt="sentinelpay logo" width="220"/>
</p>

<p align="center">
  <a href="https://github.com/ceemv22/sentinelpay/releases/latest"><img src="https://img.shields.io/github/v/release/ceemv22/sentinelpay?color=00f0ff&label=version&style=flat-square" alt="Version"></a>
  <a href="https://sentinelpay.org"><img src="https://img.shields.io/badge/status-production_hardened-00f0ff?style=flat-square" alt="Status"></a>
  <a href="https://x.com/sentinelpayorg"><img src="https://img.shields.io/twitter/follow/sentinelpayorg?style=social" alt="Twitter"></a>
</p>

<h3 align="center">
  the security oracle for high-stakes crypto commerce.
</h3>

<p align="center">
  sentinelpay is a high-performance risk scoring engine designed to sit at the edge of your payment flow.<br>
  <b>detect. block. comply.</b>
</p>

---

## 🛡️ state of the protocol: phase 3 (production hardened)

sentinelpay has graduated from active development to **production stable**. the current architecture is hardened against advanced evasion techniques and infrastructure-level attacks.

### why sentinelpay?
most risk scoring happens *after* a transaction is mined. for b2b operators, this is too late. sentinelpay provides **sub-second pre-deposit verification**, allowing you to reject illicit funds before they contaminate your treasury.

---

## ⚙️ the engine (heuristics v3.5)

our proprietary engine performs a deep forensic scan across all transaction types (normal, internal, and erc-20) with a depth of up to **10,000 transactions** per wallet.

| heuristic | description | status |
|-----------|-------------|--------|
| `sanctioned_entity` | direct match with ofac, mixers, or known sanctioned addresses. | **active** |
| `mixer_interaction` | inbound/outbound flow from tornado cash, sinbad, and 140+ others. | **active** |
| `history_incomplete` | detection of **history flooding** (evasion attempts using 10k+ tx). | **new** |
| `high_velocity` | > 50 transactions broadcasted within a 24h rolling window. | **active** |
| `new_wallet` | on-chain birth timestamp < 30 days. | **active** |
| `io_imbalance` | highly skewed inbound vs outbound capital ratios. | **active** |

---

## 🔒 s-tier cybersecurity architecture

we don't just secure your payments; we secure our own infrastructure to protect your data.

- **hybrid trust ip resolution**: advanced cloudflare + railway header verification for accurate rate-limiting and audit logging.
- **atomic billing**: credits and api key provisioning are handled via isolated prisma transactions.
- **aes-256-gcm encryption**: sensitive data is encrypted at rest using industry-standard authenticated encryption with versioned rotation support.
- **hpp & clickjacking protection**: implementation of http parameter pollution (hpp) protection and strict `frame-ancestors` csp directives.
- **zero-retention policy**: raw api keys are permanently erased from the database immediately after the one-time user reveal.

---

## 🚀 integration in < 60 seconds

sentinelpay is designed for seamless b2b integration. use your `x-api-key` to secure your deposit flows.

```bash
curl -X POST https://api.sentinelpay.org/v1/score \
  -H "x-api-key: sp_live_xxxxxxxxxxxxxxxx" \
  -d '{"wallet": "0x..."}'
```

**sample response:**
```json
{
  "wallet": "0x...",
  "score": 85,
  "category": "high",
  "flags": ["mixer_interaction", "history_incomplete"],
  "timestamp": "2026-05-04T00:00:00.000Z"
}
```

---

## 🌐 ecosystem

| node | url |
|------|-----|
| **official portal** | [sentinelpay.org](https://sentinelpay.org) |
| **b2b dashboard** | [sentinelpay.org/dashboard](https://sentinelpay.org/dashboard) |
| **public core** | [github.com/ceemv22/sentinelpay-public](https://github.com/ceemv22/sentinelpay-public) |
| **x / twitter** | [@sentinelpayorg](https://x.com/sentinelpayorg) |

---
// sentinelpay // security by architecture.

# sentinelpay

<p align="center">
  <img src="api/public/logo.svg" alt="SentinelPay Logo" width="200"/>
</p>

**Live at: [sentinelpay.org](https://sentinelpay.org)**

**real-time wallet risk scoring API for crypto payment flows**

score a wallet address before you accept a deposit. one API call returns a risk score, category, and flags — so you can reject bad funds before they hit your platform.

built for crypto casinos, high-risk payment platforms, OTC desks, and onchain marketplaces.

---

## the problem

most crypto platforms check risk too late — after the deposit lands, or not at all. blockchain analytics tools exist but they're enterprise-only, slow to integrate, and expensive. internal blacklists miss novel threats.

the result: financial exposure, compliance risk, and operational overhead.

---

## the solution

sentinelpay sits between the wallet and the deposit acceptance. one POST request, instant decision.

```
wallet address → sentinelpay → risk score + flags → accept or reject
```

---

## live products (phase 2 active)

### 1. public PLG tool (free risk scanner)
check any wallet directly via our simple UI without registration at **[sentinelpay.org](https://sentinelpay.org)**. 
features traffic-light assessment logic (red/yellow/green) with a strict IP-based rate limit.

**endpoint:** `POST /v1/public/score` (strictly limited to 5 req/hour/IP)

### 2. B2B enterprise API
integrate directly into your payment processor. requires active authentication via `x-api-key`.

**endpoint:** `POST /v1/score`

```bash
curl -X POST https://sentinelpay.org/v1/score \
  -H "Content-Type: application/json" \
  -H "x-api-key: sp_your_api_key_here" \
  -d '{"wallet": "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b"}'
```

---

## risk scoring

| score | category | meaning |
|-------|----------|---------|
| 0–29 | low | likely safe to accept |
| 30–59 | medium | manual review recommended |
| 60–100 | high | recommend rejection |

### signals (v1.0)

| flag | description | score impact |
|------|-------------|-------------|
| `mixer_interaction` | wallet interacted with Tornado Cash or known mixers | +50 |
| `new_wallet` | wallet is less than 30 days old | +20 |
| `high_velocity` | more than 50 transactions in the last 24 hours | +20 |
| `io_imbalance` | heavily skewed inbound/outbound ratio | +10 |

---

## tech stack

- **API layer:** Node.js + Express
- **scoring engine:** Python (rule-based heuristics via Etherscan)
- **database:** PostgreSQL (via Prisma ORM) for Audit Logging & API Auth
- **scaling:** Redis for distributed rate-limiting
- **frontend:** Vanilla HTML/CSS Glassmorphism UI
- **billing:** Stripe Checkout integration

---

## pricing

| plan | price | requests |
|------|-------|----------|
| starter | $99–$299 / month | 5,000 req |
| pro | $500+ / month | 25,000 req |
| enterprise | custom | unlimited |

*phase 1/2 is open to design partners — **free 30-day access** for operators who want to test in production and provide feedback.*

---

## roadmap

**phase 1 (completed)**
- [x] real-time wallet scoring via REST API
- [x] four core risk signals
- [x] basic rate limiting 

**phase 2 (completed)**
- [x] free public frontend (PLG tool) with traffic light UI
- [x] API key authentication (hashed into DB)
- [x] Stripe billing + webhooks integration
- [x] Redis distributed rate limiting
- [x] Postgres audit logging

**phase 3 (next)**
- [ ] Solana support
- [ ] ML-based scoring layer
- [ ] automated ML model retrains based on chargeback data

---

## contact

interested in early access or a demo?

- twitter / X: [@Ceemv22](https://x.com/Ceemv22)
- github: [@ceemv22](https://github.com/ceemv22)
- email: ceem@sentinelpay.org
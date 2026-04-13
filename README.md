# sentinelpay

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

## live API

```
https://sentinelpay-production.up.railway.app
```

---

## quickstart

```bash
curl -X POST https://sentinelpay-production.up.railway.app/v1/score \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b"}'
```

**response:**

```json
{
  "wallet": "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
  "score": 60,
  "category": "high",
  "flags": ["mixer_interaction", "io_imbalance"],
  "timestamp": "2026-04-13T21:17:09.883Z"
}
```

---

## risk scoring

| score | category | meaning |
|-------|----------|---------|
| 0–29 | low | likely safe to accept |
| 30–59 | medium | manual review recommended |
| 60–100 | high | recommend rejection |

### signals (phase 1)

| flag | description | score impact |
|------|-------------|-------------|
| `mixer_interaction` | wallet interacted with Tornado Cash or known mixers | +50 |
| `new_wallet` | wallet is less than 30 days old | +20 |
| `high_velocity` | more than 50 transactions in the last 24 hours | +20 |
| `io_imbalance` | heavily skewed inbound/outbound ratio | +10 |

---

## API reference

### POST `/v1/score`

**request:**

```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e695d487DA2"
}
```

**success response (200):**

```json
{
  "wallet": "0x742d35cc6634c0532925a3b844bc9e695d487da2",
  "score": 10,
  "category": "low",
  "flags": [],
  "timestamp": "2026-04-13T10:00:00Z"
}
```

**error responses:**

| code | meaning |
|------|---------|
| 400 | invalid wallet address format |
| 413 | request body too large |
| 429 | rate limit exceeded (30 req / 15 min) |
| 504 | scoring engine timeout |

### GET `/health`

```bash
curl https://sentinelpay-production.up.railway.app/health
```

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-04-13T21:36:02.063Z"
}
```

---

## tech stack

- **API layer:** Node.js + Express
- **scoring engine:** Python (rule-based heuristics)
- **chain data:** Etherscan API (Ethereum mainnet)
- **deployment:** Railway (Docker)
- **security:** helmet, rate limiting, body size limit, subprocess timeout

---

## pricing

| plan | price | requests |
|------|-------|----------|
| starter | $99–$299 / month | 5,000 req |
| pro | $500+ / month | 25,000 req |
| enterprise | custom | unlimited |

phase 1 is open to design partners — **free 30-day access** for operators who want to test in production and provide feedback.

---

## roadmap

**phase 1 (now)**
- [x] real-time wallet scoring via REST API
- [x] four core risk signals
- [x] rate limiting + security hardening
- [x] OpenAPI 3.0 documentation

**phase 2**
- [ ] API key authentication + per-client rate limiting
- [ ] usage dashboard
- [ ] Postgres audit logging
- [ ] Solana support
- [ ] ML-based scoring layer

---

## contact

interested in early access or a demo?

- github: [@ceemv22](https://github.com/ceemv22)
- email: ceemv22@aol.com

> phase 1 is open for design partners. no strings attached — just looking for real operators to test with.
# sentinelpay

<p align="center">
  <img src="api/public/logo.svg" alt="sentinelpay logo" width="200"/>
</p>

**live at: [sentinelpay.org](https://sentinelpay.org)**

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

## live products (production ready)

### 1. public PLG tool (free risk scanner)
check any wallet directly via our simple UI without registration at **[sentinelpay.org](https://sentinelpay.org)**.  
features traffic-light assessment logic (red/yellow/green) with a strict IP-based rate limit.

**endpoint:** `POST /v1/public/score` (ip-daily + fingerprint limited)

### 2. user dashboard & self-serve
full self-serve portal for developers and compliance teams.  
features:
- **social auth**: google & x (twitter) integration via supabase.
- **credit system**: pay-as-you-go risk scanning.
- **scan history**: secure, idor-protected history of all processed wallets.
- **api key management**: hashed security for b2b integrations.

**dashboard:** `https://sentinelpay.org/dashboard`

---

## risk scoring

| score | category | meaning |
|-------|----------|---------|
| 0–29 | low | likely safe to accept |
| 30–59 | medium | manual review recommended |
| 60–100 | high | recommend rejection |

### signals (v3.0)

| flag | description | score impact |
|------|-------------|-------------|
| `sanctioned_entity` | wallet address is a direct match in our high-risk/ofac database | +100 |
| `mixer_interaction` | wallet interacted with tornado cash, sinbad, chipmixer or known mixers | +50 |
| `new_wallet` | wallet is less than 30 days old | +20 |
| `high_velocity` | more than 50 transactions in the last 24 hours | +20 |
| `io_imbalance` | heavily skewed inbound/outbound ratio | +10 |

---

## tech stack

- **auth:** supabase (jwt, google/twitter oauth)
- **api layer:** node.js + express (v5/helmet/hsts)
- **scoring engine:** python (rule-based heuristics via etherscan)
- **database:** postgresql (prisma orm)
- **scaling:** redis (distributed daily ip/fp rate-limiting)
- **frontend:** vanilla html/css glassmorphism (mobile-optimized 100dvh)
- **billing:** stripe checkout & webhooks

---

## roadmap

**phase 1, 2, & 2.5 (completed)**
- [x] real-time wallet scoring via rest api
- [x] api key authentication (sha-256 hashed)
- [x] stripe billing + redis rate limiting
- [x] postgres audit logging
- [x] 140+ origin mixer/sanctioned database

**phase 3 — enterprise & self-serve (completed)**
- [x] self-serve signup + user dashboard + credit system
- [x] google & x (twitter) social login integration
- [x] email verification & anti-abuse fingerprinting
- [x] atomic credit protection (race-condition free)
- [x] s-tier security hardening (strict csp, hsts, ddos engine protection)

**phase 4 (upcoming)**
- [ ] solana support
- [ ] ml-based scoring layer
- [ ] telegram bot integration for instant alerts

---

## security (s-tier certified)

sentinelpay is built for maximum production resilience:
- **injection protection**: strict content-security-policy (csp). no `innerHTML` in frontend.
- **idor protection**: every scan result is bound to a verified uuid; users cannot access each other's data.
- **ddos protection**: redis rate-limiters (ip/fp/api) + transaction fetch limits in the scoring engine.
- **privacy**: all api keys are hashed; cleartext keys never touch logs or databases.
- **encryption**: forced hsts (ssl/tls) with 1-year preload.

---

## contact

- twitter / x: [@sentinelpayorg](https://x.com/sentinelpayorg)
- github: [@ceemv22](https://github.com/ceemv22)
- email: ceem@sentinelpay.org
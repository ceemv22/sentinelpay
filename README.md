<p align="center">
  <img src="api/public/logo.svg" alt="sentinelpay" width="200"/>
</p>

<p align="center">
  <strong>pre-deposit wallet risk scoring for crypto treasuries</strong>
</p>

<p align="center">
  <a href="https://sentinelpay.org">sentinelpay.org</a>
  ·
  <a href="https://sentinelpay.org/start-free-trial">start a free trial</a>
  ·
  <a href="https://sentinelpay.org/book-a-demo">book a demo</a>
  ·
  <a href="https://x.com/sentinelpayorg">@sentinelpayorg</a>
</p>

---

**this repository is the public site at sentinelpay.org**: the marketing pages, the blog, the legal pages, and the two endpoints behind the sign-up forms. the scoring api and the risk engine are separate services and live in their own repositories.

the site is in production. it serves three languages, renders per request, ships a content security policy with no `unsafe-inline` for scripts, and never loses a form submission even when email delivery fails.

## what is here

```
api/
  index.js            server: routing, rendering, security headers, form endpoints
  mailer.js           every outbound email, in one place
  submissions-log.js  append-only record of everything the forms receive
  public/             11 pages, 3 stylesheets, 4 scripts, all assets
content/              blog author data
docs/                 site overview, written for people joining the project
help-center/          help.sentinelpay.org, a separate small service
tools/                the translation audit that gates every release
```

no build step, no framework, no bundler. the pages are html on disk; the server adds what only it can know.

### branches

| branch | what it is |
| --- | --- |
| `main` | the site, deployed on every push |
| `dev` | an older line of work, last touched june 2026 |
| `legacy/app-snapshot` | the application this repository used to hold, before it was stripped down to the site: prisma schema, supabase auth, the dashboard. kept because it is the only copy, and worth reading before rebuilding any of it |

## the site

| page | url |
| --- | --- |
| homepage | `/` → `/en`, `/hr` or `/de` |
| free trial | `/start-free-trial` |
| book a demo | `/book-a-demo` |
| blog | `blog.sentinelpay.org`, four articles |
| legal | `/privacy-policy`, `/terms-of-service` |
| help centre | `help.sentinelpay.org` |

## three languages, one source of truth

english, croatian and german. **592 translated strings per language**, keyed on the english source text rather than on invented ids, so a page and its dictionary can never drift apart silently.

- **the homepage has real addresses**: `/en`, `/hr`, `/de`, each with a self-referencing canonical and `hreflang` alternates. the bare domain resolves a language and redirects to it, 302 and never cached, because the answer depends on the visitor.
- **first visit picks a language from the visitor's country**, resolved server-side from `cf-ipcountry`. the guess is never written to the cookie, so it cannot harden into a stored preference.
- **tab titles are translated before first paint.** an inline script in `<head>` sets the title from the cookie, so no page ever shows an english title and then swaps it. measured at one title frame per language.
- **every translated article can be read in the original.** croatian and german readers get a pill under the byline that flips one article back to the english it was written in, headline, body and tab title together, while the site stays in their language. english readers are already reading the original, so they never see the button.
- **`tools/i18n-audit.py` refuses to pass on any untranslated string**, including strings written at runtime by javascript. it currently reports zero missing.

## security

| control | how |
| --- | --- |
| content security policy | every inline script is hashed at boot and listed, so `script-src` needs no `unsafe-inline`. `script-src-attr 'none'` blocks inline event handlers. styles still allow it |
| clickjacking | `frame-ancestors 'none'` |
| transport | hsts, two years, `includeSubDomains`, preload |
| bot defence | cloudflare turnstile on both forms, plus a honeypot field |
| origin lockdown | a secret injected by a cloudflare transform rule; with `CF_ORIGIN_STRICT` the origin answers 403 to anything that did not come through cloudflare |
| rate limits | 300/min per ip site-wide, 5/hour for demo requests, 3/hour for trial sign-ups |
| ip trust | `cf-connecting-ip` is trusted only when the request proves it came through our own cloudflare, so a forged header cannot buy a fresh rate-limit bucket |
| input | 10kb body cap, parameter pollution guard, strict field validation, free-mail and disposable domains rejected as company domains |
| headers | `nosniff`, `no-referrer`, and a permissions policy that turns off every sensor api |

the site works with javascript switched off far enough to say so: the loader stays, and underneath it a message in the visitor's language links to instructions for their exact browser.

## forms

| form | who gets an email | logged |
| --- | --- | --- |
| homepage, `/book-a-demo` | the team, at `MAIL_TO` | yes |
| `/start-free-trial` | the applicant, in their own language, plus a copy to the team | yes |

a trial sign-up is verified automatically: the work email must sit on the company's own domain, free and disposable providers are refused on both sides, and gambling operators are declined by policy in the form and again on the server.

every submission is written to `LOG_DIR/submissions-YYYY-MM.jsonl` **and** to stdout before any email is attempted, so a bounce, an outage or a missed inbox never costs a lead. emails are sent through resend from `noreply@sentinelpay.org`, in the site's own dark house style, with a plain-text alternative.

## contributing

`CONTRIBUTING.md` is the short list of things that are easy to get wrong here: the
house style, the two rules that break production if forgotten, and the parts of this
codebase that behave in a way you would not expect.

## running locally

```bash
cd api && npm install && npm run dev
```

that is the whole setup. with no `RESEND_API_KEY` the mailer writes each message to a preview file instead of sending, so the forms are testable offline.

### environment

nothing is required to boot. everything below changes behaviour when set.

| variable | effect |
| --- | --- |
| `RESEND_API_KEY` | enables outbound email. in production its absence is a hard failure, never a silent one |
| `MAIL_TO`, `MAIL_FROM` | where form notifications land and who they come from |
| `TRIAL_APP_URL` | adds the "open your trial" button to the welcome email |
| `TURNSTILE_SECRET_KEY` | enforces the bot challenge. without it the forms accept unverified submissions |
| `CF_ORIGIN_SECRET`, `CF_ORIGIN_HEADER` | the shared secret a cloudflare transform rule injects |
| `CF_ORIGIN_STRICT` | extends that guard to every route, so the origin url is useless on its own |
| `ALLOWED_ORIGINS` | cors allowlist. a wildcard is refused in production |
| `LOG_DIR` | where the submission log is written. point it at a mounted volume, otherwise it resets on redeploy |
| `ADMIN_TOKEN` | enables the operations endpoints below |
| `CSP_STRICT` | set to `false` only to fall back to `unsafe-inline` in an emergency |

### status banner

a running incident is announced above the nav on every page, and the form submit is
disabled while it stops mail reaching us, so nobody is walked through four steps into
a dead end. env-driven, so it goes up and comes down without a deploy: unset
`STATUS_MESSAGE` and the banner, the attributes and the disabling all disappear.

| variable | effect |
| --- | --- |
| `STATUS_MESSAGE` | a preset key, or free text. empty or unset hides everything |
| `STATUS_LINK`, `STATUS_LINK_TEXT` | optional link. a preset supplies its own label |
| `STATUS_BLOCKS_MAIL` | `true` while submissions cannot reach us |
| `STATUS_MESSAGE_HR`, `STATUS_MESSAGE_DE` | croatian and german text for a custom message |
| `STATUS_LINK_TEXT_HR`, `STATUS_LINK_TEXT_DE` | the same, for a custom button label |

presets are written properly in all three languages and need nothing else set:
`email-outage` · `degraded` · `maintenance`. free text shows as typed in every
language unless the per-language variables are given: machine translating whatever
someone types would produce exactly the stiff wording the rest of the site avoids.

`STATUS_BLOCKS_MAIL=true` disables every form's submit button, in the markup and not
only visually, and makes the forms' mailto fallback inert. the support and privacy
addresses in the footer and the legal pages stay clickable on purpose: they are the
contact routes those pages are obliged to offer.

### operations

with `ADMIN_TOKEN` set:

```
GET  /v1/submissions?token=…&limit=50&kind=trial   read the submission log back
GET  /v1/mail-status?token=…                       what the mailer is configured with
POST /v1/mail-status?token=…&send=1                send a test message and report the provider's answer
```

all three answer with the ordinary 404 page when the token is missing or wrong, so their existence is not discoverable. the comparison is timing-safe.

## releasing

deployed on railway from the dockerfile at the repository root, behind cloudflare. pushing to `main` deploys.

two rules matter:

1. **bump the `?v=` on any stylesheet or script you touch.** assets are served with a one-year immutable cache; the query string is the only thing that busts it.
2. **run the translation audit before pushing.** it must report zero missing.

```bash
node tools/i18n-keys.js /tmp/keys.json && python3 tools/i18n-audit.py /tmp/keys.json
```

html is never cached hard, so copy changes go live with the deploy.

## stack

| layer | tech |
| --- | --- |
| runtime | node 22, express 5 |
| email | resend |
| edge | cloudflare: dns, waf, turnstile, geo, email routing |
| hosting | railway, docker |
| dependencies | seven, all direct. no framework, no bundler, no build |

## license

mit

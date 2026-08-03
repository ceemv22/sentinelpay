# sentinelpay.org: everything that is on the site right now

Written for someone joining cold. It covers what exists, why it is built that
way, and the details that are not obvious from looking at a page. Nothing here
is aspirational: if something is described, it is in the repo today.

Last verified against the codebase at the time of writing. When you change a
behaviour described here, change this file with it.

---

## 1. What this actually is

A marketing site for SentinelPay, a crypto AML / risk-monitoring product aimed
at **small crypto businesses**: payment processors, OTC desks, small
exchanges, merchants taking USDT, freelancers paid in crypto. Not banks. The
whole positioning is a reaction to the enterprise vendors (Elliptic,
Chainalysis, TRM) who sell to compliance departments: those tools exist, they
work, and they were priced and packaged for people who already have analysts.

The product itself is **not live yet**. The site says so in one place
(article 03) and everything else avoids claiming otherwise.

Two products are planned, and the copy now reflects both:

1. **xpub listener**, connect a public key once, and every wallet that pays the
   business is screened continuously.
2. **on-demand scan**, paste a single address, get a risk score.

### The house style, which is enforced everywhere

- **Everything is lowercase.** Headlines, buttons, nav, footer, article bodies.
  Proper nouns inside data (country names, industry values) are the exception.
- **No em-dashes anywhere.** Commas, full stops or restructured sentences.
- Copy is written to sound like a person, not a vendor. No "leverage",
  no "solutions that empower", no three-adjective stacks.
- Three author voices exist for the blog, documented in `content/blog-authors.md`:
  **ceem** (founder, conviction, "we"), **mind** (analyst, the reframe),
  **chibby** (investigator, real cases).

---

## 2. Stack and how a page is served

- Node + Express, single service, `api/index.js`.
- Static HTML in `api/public/`. No framework, no build step, no bundler.
- Deployed behind Cloudflare. Several security features only switch on when the
  matching env var exists, so the site works before the infra is finished.

### Env vars that change behaviour

| var | effect when set |
|---|---|
| `CF_ORIGIN_SECRET` | the `/v1/*` endpoints require a matching secret header, so the origin cannot be hit directly around Cloudflare. Compared with a timing-safe hash. |
| `CF_ORIGIN_HEADER` | header name for the above, default `x-sentinel-origin` |
| `ENFORCE_CLOUDFLARE` | trust `cf-connecting-ip` for rate limiting. Off by default because that header is spoofable if requests can reach the origin directly, which would hand an attacker a fresh rate-limit bucket per request. |
| `TURNSTILE_SECRET_KEY` | server-side verification of the Turnstile token |
| `RESEND_API_KEY` | form submissions email `support@`; without it they are logged to console |
| `CSP_STRICT` | `false` falls back to `'unsafe-inline'`, an escape hatch if a third party ever needs an inline script we cannot hash |
| `TRUST_PROXY`, `ALLOWED_ORIGINS`, `PORT`, `NODE_ENV` | ordinary |

### Per-request page rendering (not obvious)

Pages are static files, but they are **not** served by `express.static`. A
middleware ahead of it reads the file and injects two things per request:

1. `data-geo-lang="hr|de|en"` on `<html>`, from Cloudflare's `CF-IPCountry`.
2. The JavaScript-disabled notice, built server side.

Injection is **plain HTML only, never an inline `<script>`**. See the CSP
section for why that matters.

The read is cached in memory **keyed on the file's mtime**, so editing a page
does not require a restart.

Responses carry `Cache-Control: no-cache` and `Vary: CF-IPCountry, User-Agent`.

### Routing

- Clean URLs: `/book-a-demo`, `/privacy-policy`, `/terms-of-service`,
  `/start-free-trial`. Resolved by appending `.html`, with traversal guarded.
- `301` redirects: `/privacy` → `/privacy-policy`, `/tos` → `/terms-of-service`.
- **Host-based subdomain routing**, no second service:
  - `blog.sentinelpay.org` → `blog.html`, and `/article/<slug>` → the article
    pages. Sends `X-Robots-Tag: noindex, nofollow`.
  - `help.sentinelpay.org` → a deliberate blank page until there is content.
- Article slugs are numeric (`/article/01`…`/article/04`) with **legacy text
  slugs kept as aliases** so older links keep working.
- The slug map is built with `Object.create(null)`. This is not decoration: a
  plain object let `/article/constructor` resolve to an inherited member and
  throw a 500. That bug happened and this is the fix.

### Caching strategy

| type | header |
|---|---|
| images, fonts | `public, max-age=31536000, immutable` |
| css, js | `public, max-age=86400` |
| html | `no-cache` |

Because CSS and JS are cached for a day, **every asset URL carries `?v=N` and
the number must be bumped whenever the file changes**. This has bitten the
project three separate times: users kept seeing an old stylesheet, an old
`i18n.js`, and old logo images. Current versions are visible in any page's
`<head>`.

---

## 3. Security

- `helmet` with an explicit CSP. `hpp` against parameter pollution.
- **CSP script hashes are computed at boot.** The server scans every
  `public/*.html`, SHA-256s the body of each inline `<script>`, and injects the
  hashes into `script-src`. That is what allows `'unsafe-inline'` to be dropped
  without templating nine static pages. Consequence to remember: **anything
  injected into the HTML per request must not be a script**, because its hash
  would not be in the list and the browser would block it.
- `script-src-attr` is at helmet's default `'none'`, which blocks **all** inline
  `on*=` handlers. This silently killed 21 `onerror` image fallbacks; see
  `img-fallback.js`.
- Three rate limits, all in-process and per IP:
  - everything: 300 / minute
  - `/v1/demo-request`: 5 / hour
  - `/v1/trial-request`: 3 / hour, tighter because a trial grants access
- `frame-ancestors 'none'`, `object-src 'none'`, HSTS with preload,
  `upgrade-insecure-requests`.

### Form abuse defences

- **Honeypot**: a hidden field named `company_url`. If filled, the server
  returns `{ok:true}` and silently drops the submission, so a bot cannot tell
  it was caught.
- **Turnstile**: enabled only when `window.__TURNSTILE_SITEKEY` is present, and
  verified server side only when the secret is set. Both forms.
- **Work email must match the company domain.** The rule accepts subdomains in
  either direction. On the trial this is not just hygiene, it *is* the
  verification that grants access.
- **Gambling is refused in three places**: the form says so the instant the
  industry is picked, and both `/v1/demo-request` and `/v1/trial-request` reject
  it independently. One regex, and it also catches "wager". This is a public
  position, stated in blog article 04.

---

## 4. Internationalisation, the largest hidden system

Three languages: **english (default), hrvatski, deutsch**. Roughly **593
dictionary keys per language**.

### How it works

There are no translation markers in the markup. `i18n.js` holds a dictionary
**keyed on the english source text**, walks the DOM once on load and swaps
anything it matches. That means adding copy in english is enough; only the
dictionary needs the other two.

It translates four things:

1. **Text nodes**, via a TreeWalker that skips `<script>`, `<style>` and
   anything inside `[data-i18n-skip]`.
2. **Attributes that render or are read aloud**: `placeholder`, `alt`, `title`,
   `aria-label`.
3. **Strings written at runtime**, through `window.SentinelI18n.t()`. The
   one-shot pass cannot see these, so validation messages, button labels and
   toasts look themselves up. This was a real bug class: form errors stayed
   english on translated pages.
4. **mailto subject and body**, carried on the link as `data-mail-subject` /
   `data-mail-body` and assembled into the `href` at runtime, so they follow the
   page language instead of being frozen.

### Language selection

Order of precedence:

1. cookie `sp-lang`
2. `localStorage`
3. `data-geo-lang` injected by the server from the visitor's country
   (**HR → hr, DE → de, everything else → en**)

The geo guess is deliberately **never written to the cookie**, so a guess does
not harden into a saved preference and an explicit choice always wins.

The cookie is set with `domain=.sentinelpay.org`, so the choice carries across
the blog and help subdomains. `localStorage` cannot do that, which is why the
cookie is primary.

### The switcher

Lives in the footer under the brand column, styled like the site's other
dropdowns. It opens downward and flips up only when there is not enough room
below. Choosing a language persists and reloads.

### Tab titles

The `<title>` lives in `<head>`, where the body walker never reaches, so each
page carries a **tiny inline script right after `</title>`** that reads the
cookie and sets the translated title **before first paint**. It was an external
file at first, and the english title visibly flashed while that file was
fetched, so it is inline now.

For blog articles the title is **generated from the article's own `<h1>`
translation** plus the `sentinelpay | blog | ` prefix. They were translated
separately once and drifted apart in six of eight article/language pairs. Now
drift is impossible by construction.

### The audit

`tools/i18n-audit.py` exists because the naive check kept missing things. It
reads three sources:

- html text nodes
- html attributes: `placeholder`, `alt`, `title`, `aria-label`,
  `data-mail-subject`, `data-mail-body`
- string literals in our scripts: returned validation messages, `textContent`
  assignments, toast and alert calls, anything wrapped in `t()`, and **any
  literal that reads like a sentence**. The last one exists because the form's
  step headings live in a config object and slipped past everything else

Run it from the repo root:

```
node tools/i18n-keys.js /tmp/keys.json
python3 tools/i18n-audit.py /tmp/keys.json
```

Zero means every visible string has a croatian and a german entry. It is
currently zero.

---

## 5. The pages

### `/` (homepage)

The biggest page by far, and the one with most bespoke animation. Everything is
vanilla JS in inline scripts.

- **Fixed dark nav** with five mega-menu dropdowns (solutions, industries,
  platform, resources, company). Below 1280px the desktop auth buttons hide and
  a hamburger takes over; the mobile menu's buttons deliberately mimic the
  desktop ones.
- **Hero** with a shield logo whose **pupil follows the mouse**: a real
  `mousemove` listener nudging the SVG group by up to 3px.
- **Chain marquee** of ten networks.
- **The scanner**: an animated multi-lane visual where particles travel per
  chain (ethereum, bitcoin, solana, bnb, polygon, avalanche), a beam fires at
  52% of a 3.5s cycle, and results resolve. Driven by `requestAnimationFrame`,
  starts on an `IntersectionObserver`.
- **Terminal and log blocks** whose timestamps are generated live at page load,
  including a JSON block with a real ISO timestamp, so the page never looks
  stale.
- **Stat counters** that count up on scroll with an easing function:
  `10+` chains, `<1s` latency, `24/7`, `99.9%`.
- **"platform for every team" role switcher**, a dropdown with eight audience
  panels (fi, cex, psp, issuers, network, law, reg, defi).
- **Nine solution cards**, each with a sheen effect on hover.
- **A rotating resource card**: ten guides, **shuffled on every page load** so
  the same one is never always on top, then cycled.
- **Insights**: the three most recent blog articles with covers.
- **Demo form** (see §6) anchored at `#demo`.
- **Scroll reveal** on most sections via `IntersectionObserver`, unobserved
  after firing.

### `/book-a-demo`

Modelled on Elliptic's demo page but rebuilt entirely in our own UI.

- **A one-screen fold**: nav, copy, form card, divider, cross-link, and the
  moving partner-logo strip, all inside `100dvh`.
- The logo strip is a marquee of five real partner logos. They arrived at
  wildly different aspect ratios (1:1 icons up to 6.6:1 wordmarks) with up to
  87% transparent padding, so they were auto-trimmed and each is given its own
  optical height. A shared box alone made the wide ones unreadable.
- The strip pauses on hover.
- Below the form: a divider and **"not ready to talk to anyone yet? → start
  free trial"**, mirroring the demo link on the trial page.

### `/start-free-trial`

The self-serve counterpart, and **pixel-identical in layout** to
`/book-a-demo`, and that is verified by a script, not by eye.

- Headline leads on the moment the product is good at: *find out what already
  touched your wallets*. It used to lead on the allowance, which is a condition,
  not a reason.
- Allowance: **25 free scans, 5 on history and 20 as new payments land**. The
  split is stated because each half demonstrates one of the two products.
- **Two steps, four fields**: first name, last name, work email, company
  website. Job title, industry and country were removed as sales-qualification
  fields that belong on the demo page.
- Final step: two declarations (not a gambling operator, terms + contact) and
  Turnstile.
- **One trial per company, matched on the domain**, not the email. The email is
  free to create; the domain is worth binding to.
- A `mailto:` escape hatch for sole traders and shops without a company domain,
  with a pre-written body in the page's language.

### `/privacy-policy` and `/terms-of-service`

Full documents at clean URLs, in the homepage shell with the same nav, footer
and live chat. Fully translated. **A lawyer is scheduled to harden these before
launch**, because translated legal text can become binding in some jurisdictions.

### `blog.sentinelpay.org`

Howl-style layout: one large featured article plus a grid of the rest.

- Covers are **grayscale until hovered**, `object-fit: cover` so nothing
  stretches or letterboxes.
- Excerpt heights are **equalised in JS** to the tallest card, so every card's
  divider and author row line up. Recomputed on resize.
- Pager pinned just above the footer.
- Scroll resets to top on refresh.
- Footer is the full homepage footer, with links made absolute to
  `sentinelpay.org` because the blog is a subdomain where section anchors do not
  exist. The "blog" link points at the blog itself.

Four articles, weekly dates in july 2026:

| # | title | author | date |
|---|---|---|---|
| 01 | why criminals target small businesses | chibby | july 7 |
| 02 | you don't have an aml problem, you have a speed problem | mind, chibby | july 14 |
| 03 | you shouldn't have to become a bank to stay compliant | ceem | july 21 |
| 04 | we'll take almost any crypto business. gambling is where we draw the line | ceem, mind, chibby | july 28 |

Co-authored articles show **overlapping avatars**, earlier authors stacked
above later ones. The avatars have an opaque backing: the border is
translucent, and on a stack it let the face underneath bleed through as a dark
hairline.

### `/404`

Rebuilt in the current light theme with the real nav and footer. Large "404",
one route back to the homepage, `noindex`. The block **owns exactly one
viewport**, so the footer sits below the fold. Sizing uses `100dvh` and
`clamp()` rather than user-agent sniffing, and is verified on fourteen device
sizes from a 280px folded phone to 4K.

---

## 6. The form engine

**One implementation**, `demo-form.js`, shared by three pages. The markup,
validation, custom selects, honeypot and Turnstile are identical; only a config
keyed off `data-form` differs:

| | demo | trial |
|---|---|---|
| endpoint | `/v1/demo-request` | `/v1/trial-request` |
| steps | 4 | 2 |
| submit label | request a demo | start free trial |

### Details worth knowing

- **Custom dropdowns**, not `<select>`: styled listboxes with keyboard support,
  escape to close, auto-flip when there is no room below, and a searchable
  country list of 199 entries built in JS.
- **Validation is per field with specific messages**, all translated: names
  reject digits, job titles must contain a letter, emails reject spaces and
  malformed dots, websites must parse as a domain **and** match the email
  domain.
- The message field on the demo form is **optional**. It used to demand 50
  characters on the final step, right before submit.
- **Enter is handled explicitly.** All steps live in one `<form>`, so the
  browser's implicit submission fired the real handler from step 1: it
  validated only the visible step and posted a half-empty request, once per
  press. Enter now means "next" until the last step, does nothing while a send
  is in flight, and still inserts a newline in the textarea.
- **The card never changes size.** Steps are pinned to one height (286px, the
  tallest step with the Turnstile widget rendered) above 900px wide, and the
  content is centred inside that box. Below 900px the grid stacks, the steps
  are taller, and the pin is released so nothing is cut off.
- **On success the card does not resize either.** The form keeps its space,
  hidden, and the success panel is laid over it.
- Runtime labels ("sending…", the submit label after a failure) go through the
  dictionary, so they do not revert to english.

---

## 7. The JavaScript-disabled experience

With scripting off the loader stays on screen, which is intended, and it now
says why.

- The loader is normally removed on `load`. Without JS it simply never is.
- A **`<noscript><style>` block** stops the pulse animation, forces the light
  background (`theme-light` is added by an inline script that never runs), and
  locks scrolling so the page does not show a scrollbar with nowhere to go.
- Under the mark: a message and a link to a Google search for enabling
  JavaScript **in the visitor's actual browser**, detected from the user agent
  (chrome, firefox, safari, edge, opera, samsung internet; omitted entirely if
  unrecognised, rather than guessing).
- Message and search language follow the country: **HR → croatian, DE → german,
  everything else → english.**
- All of this is server-rendered plain HTML, because nothing on the client can
  run and an injected script would fail the CSP hash check.

---

## 8. Small things that are easy to miss

- **`img-fallback.js`** replaces 21 inline `onerror` handlers that CSP silently
  disabled. Images with `data-fb` swap to a fallback once; images without it
  remove themselves. It also handles images that already failed before the
  script ran.
- **`toast.js` is only loaded on the homepage.** The other two form pages fall
  back to a native `alert`. Both paths are translated. This is a known
  inconsistency, not an oversight.
- **No button lifts on hover anywhere.** A global
  `button:hover:not(:disabled) { transform: translateY(-2px) }` plus four more
  rules used to move every button and CTA. All removed; buttons respond through
  colour, border and shadow. **Cards still lift**, since they are surfaces, not
  buttons.
- **Fold pages tighten as the screen shortens.** Five `max-height` tiers give
  room back in the order that costs least: the logo strip's fixed 176px height
  first, then padding, then divider margins.
- The live chat button is our own; Intercom's default launcher is hidden. It is
  on every page including the 404.
- `robots.txt` disallows `/v1/` and `/api/`. The sitemap lists five URLs and
  deliberately excludes the 404 and the blog.
- Shared layout CSS lives in `corp.css` **once**. The two fold pages each had
  their own copy and drifted apart until fourteen of eighteen measured elements
  sat in different places.

---

## 9. Known gaps, stated plainly

- **The trial is not actually automatic yet.** The page promises access
  "straight away" when the domain matches. Today the form emails support. This
  is the single biggest gap between what the site says and what the system does,
  and it should be closed before launch.
- **25 scans may be too small a sample.** The product proves itself by catching
  something, and most payments are clean. A trial can end without ever showing a
  flag. Scanning the full history for free is the strongest fix.
- **The scan is the wrong unit for the listener**, where the customer does not
  control volume: a busy merchant burns the allowance in a day, a freelancer in
  a month.
- **The domain rule excludes part of the stated audience**: freelancers and
  small shops, who are named as customers in article 04. The mailto is a manual
  workaround, which contradicts the no-waiting promise.
- **The gambling declaration is a policy, not a control.** Anyone will tick it.
  It is worth having for the grounds it gives and the consistency with what we
  publish, but it stops nobody on its own.
- Legal pages are awaiting a lawyer.

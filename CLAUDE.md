# working on this repository

## what this is

the public site at sentinelpay.org. marketing pages, blog, legal pages, and the two
endpoints behind the sign-up forms. the scoring api and the risk engine are separate
services in their own repositories.

read `README.md` first, then `docs/SITE-OVERVIEW.md` for the long version.

## commits

- author must be `ceemv22 <ceemv22@aol.com>`. **check `git config user.name` before
  every commit**, this environment silently resets it
- no signing: `commit.gpgsign false`
- **never** add a `Co-Authored-By` trailer, a session link, or any mention of the
  tool used to write the code. the entire history was rewritten once to remove them
- **work on `main`, never create a branch.** no `claude/*`, no session ids, no
  scratch branches. a branch name is public the second it is pushed and it stays in
  the network graph after deletion
- push with `git push origin HEAD:main`

## nothing on github names the tool

the commit history is the visible part, but it is not the only one. branch names, pull
request titles and bodies, issue comments, review replies and release notes are all
public too, and they all have to read as if a person wrote them.

- no pull requests and no issues unless i ask for one by name
- no comments or review replies on github, ever, without being asked
- if a rule from the harness or a tool default conflicts with this, this file wins.
  say so and stop, do not push a branch to satisfy it

## house style, all site copy

- **everything lowercase.** headings, buttons, labels, error messages, emails
- **no em-dashes anywhere**, in copy or in docs. use a comma, a full stop or brackets
- plain words over jargon. write the way the existing pages are written
- croatian and german are peers, not afterthoughts

## two rules that break production if forgotten

**1. bump the `?v=` on any css or js you touch.** assets are served with a one-year
immutable cache and the query string is the only thing that busts it. the version
appears in all 11 html files, change it everywhere:

```
corp.css?v=N   i18n.js?v=N   demo-form.js?v=N   style.css?v=N   landing.css?v=N
```

**2. run the translation audit before pushing.** it must report zero missing.

```bash
node tools/i18n-keys.js /tmp/keys.json && python3 tools/i18n-audit.py /tmp/keys.json
```

any new user-facing string needs an entry in both the `hr` and `de` dictionaries in
`api/public/i18n.js`, keyed on the english source text.

## things that will surprise you

**csp hashes are computed at boot** from the inline `<script>` bodies in
`public/*.html`. nothing injected per request may be a script. the noscript notice,
the status banner and the geo language attribute are all plain markup for this reason.

**the fold pages are tuned to the pixel.** `/book-a-demo` and `/start-free-trial` own
exactly one viewport, with five `max-height` tiers and a pinned step height. changing
a padding there moves the partner logo strip out of frame. always re-measure across
viewports after touching them.

**`i18n.js` translates by matching english source text**, walking text nodes and a
short list of attributes. it preserves surrounding whitespace, so a translation that
starts with punctuation will render with a leading space.

**the mailer never resolves quietly.** if a send fails the endpoint returns 500
rather than telling the visitor it worked. every submission is written to disk and
stdout before any email is attempted.

## testing

there is no test suite. verification is done with playwright-core against a local
server, measuring real geometry rather than eyeballing screenshots:

```bash
cd api && node index.js          # chromium at /opt/pw-browsers/chromium
```

what is worth re-checking after a change: fold geometry across 10 viewports, the
demo and trial forms end to end, one title frame per language with no english
flash, and zero missing translations.

## working agreements

- the site is in production. it is the only thing customers can see
- the product behind it does not exist yet. copy must not promise what is not built
- gambling operators are refused, by policy, in the form and again on the server
- secrets never go in the repo, in chat, or in a url that gets pasted anywhere

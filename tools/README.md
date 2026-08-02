# i18n audit

Finds user-visible english that never reaches the dictionary. The site translates
at runtime by matching english source text, so anything the matcher cannot see
silently stays english. This checks all three places text comes from:

- html text nodes
- html attributes that render or are read aloud: `placeholder`, `alt`, `title`, `aria-label`
- string literals in our js that reach the user: returned validation messages,
  `textContent` assignments, toast and alert calls, and anything wrapped in `t('…')`

Run from the repo root:

    node tools/i18n-keys.js /tmp/i18n-keys.json
    python3 tools/i18n-audit.py /tmp/i18n-keys.json

Exits with a per-file list and a total. Zero means every visible string has a
croatian and german entry.

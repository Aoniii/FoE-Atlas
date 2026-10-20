# Locales

Each language is two files named after its code (e.g. `de`):

- `de.json`: translations, copied from `_template.json`
- `de.svg`: flag shown in the language switcher

Both are picked up automatically, no code change needed.
`fr.json` is the reference: every locale must have exactly the same keys (checked by `pnpm test`).

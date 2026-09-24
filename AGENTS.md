# Kea CLI guardrails

This repository is **Kea only** for CLI, hosting, and databases.

| Service | Identity |
| --- | --- |
| GitHub | `shooper69/KEA` |
| Supabase | `laubnngplqvsxokbfski` (Kea Production), CLI profile `kea` |
| Netlify | site `keachat`, domain `kea.chat` |

Write the product name as **Kea**, never KEA (the GitHub path `shooper69/KEA` is the repo id).

Allowlist: `kea.cli.json`. Check: `npm run guard`.

CLI identity is **not** the machine-wide supabase/netlify login (those belong to other products). Use gitignored tokens in `.kea/`:

- `.kea/supabase-access-token` — account that owns `laubnngplqvsxokbfski`
- `.kea/netlify-auth-token` — Kea Netlify team for `keachat`

```bash
npm run kea:supabase -- login
npm run kea:supabase -- link
npm run kea:netlify -- login
npm run kea:netlify -- link
npm run kea:github -- auth status
```

Wrappers refuse tokens that can see another product’s projects or teams. Do not call `supabase`, `netlify`, or `gh` in this folder without those wrappers.

## Reading other repos (source only)

If the user **explicitly** allows it in chat, agents may read source in another local folder (e.g. Investech) to adapt patterns into Kea. Do not use that product’s CLIs, tokens, env, or databases. Ship only Kea-owned code and Kea identities above.

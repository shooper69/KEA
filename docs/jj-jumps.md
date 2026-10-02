# JJ jumps

Standing agent instructions for Kea (`shooper69/KEA` only).

## Play Store AAB notice (required)

After any completed work (or when proposing work), **always tell the user** whether a **new Play Store AAB** is required.

Say one of:

- **New AAB required** — with a one-line why (what changed that ships inside the Capacitor Android bundle).
- **No new AAB** — with a one-line why (web-only / Netlify / Supabase / docs / no change to the packaged app shell or bundled `dist`).

### When a new AAB is required

Anything that must appear inside the Play-installed app after `npm run cap:sync` + `npm run android:bundle`, including:

- UI, assets, or client JS/CSS that ship in Vite `dist`
- Capacitor / Android native config, permissions, icons, package id, versionCode / versionName
- Changes under `android/` that affect the release bundle

See `docs/play-aab.md` for build steps.

### When a new AAB is not required

- Netlify functions / redirects / env only (if the app already calls production `kea.chat`)
- Supabase / Stripe / GitHub / docs-only / agent rules
- Pure website deploys that do not need a new packaged Play binary (still say so explicitly)

Do not assume the user remembers — state it every time work finishes or when the answer depends on shipping via Play.

# Release 2 — Play Store final app release

This release marks the **final Android app build** intended for Google Play Store publication.

## Scope
- Capacitor Android package: `chat.kea.app`
- Play upload artifact: signed release AAB (`app-release.aab`)
- Web shell origin: `https://kea.chat` (Stripe Checkout remains on kea.chat, not Play Billing)
- Android `versionCode` / `versionName`: `1` / `1.0.0` (as shipped in this tree)

## Included
- Production chat / talk gate and subscription-aware APIs
- Mic start/stop, wake word, and stop-word behavior for the installed app shell
- PWA + Capacitor sync path documented in `docs/play-aab.md`

## Play Console
Upload the signed AAB from `android/app/build/outputs/bundle/release/app-release.aab` (built with `npm run android:bundle` and `android/key.properties`) as the production / store listing candidate for this release.
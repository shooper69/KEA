# Play AAB — Kea (Capacitor Android)

Package id: `chat.kea.app`  
App name: Kea  
Repo: `shooper69/KEA` only. Stripe stays on **kea.chat** (not Play Billing).

## What this wraps

Capacitor ships the Vite `dist` build inside a WebView. Origin is set to `https://kea.chat` so `/api/*` hits production Netlify. Mic uses `RECORD_AUDIO`. Stripe Checkout / portal open in the system browser (`@capacitor/browser`).

## One-time machine setup

1. **JDK 21+** (Microsoft OpenJDK or Temurin — Capacitor 8 / current Android toolchain needs 21)
2. **Android Studio** (or SDK command-line tools) with SDK Platform 36 + Build-Tools
3. Set `JAVA_HOME` and `ANDROID_HOME` (SDK often `%LOCALAPPDATA%\Android\Sdk`)

Optional local portable JDK for this repo: `.kea/jdk-21` (gitignored).

## One-time signing (owner)

Create an upload keystore (keep a backup offline — losing it blocks updates):

```bash
keytool -genkey -v -keystore android/kea-upload.keystore -alias kea -keyalg RSA -keysize 2048 -validity 10000
```

Copy `android/key.properties.example` → `android/key.properties` (gitignored) and fill passwords / paths.

In Play Console: create app **Kea**, package `chat.kea.app`, enroll Play App Signing.

## Build the AAB

```bash
npm run android:bundle
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

Without `android/key.properties`, Gradle may still produce an AAB signed with the **debug** key — Play Console needs your **upload** keystore. Create `key.properties` first (above), then rebuild before submitting.

Or open Android Studio:

```bash
npm run android:open
```

Then **Build → Generate Signed Bundle / APK**.

## After each web release that should ship in Play

```bash
npm run cap:sync
npm run android:bundle
```

Bump `versionCode` / `versionName` in `android/app/build.gradle` before each Play upload.

## Play Console checklist (owner)

- [ ] Upload AAB to internal / closed testing
- [ ] Data safety + content rating
- [ ] Privacy: https://kea.chat/privacy-policy
- [ ] Account deletion: https://kea.chat/delete-account
- [ ] Support: https://kea.chat/support
- [ ] Tester emails in Play Console
- [ ] Device smoke: install → mic talk → login

## Icons

Default Capacitor icons ship for now. Replace `android/app/src/main/res/mipmap-*` with Kea brand assets before production listing.

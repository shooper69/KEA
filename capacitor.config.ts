import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Kea Android shell for Play Store.
 * Bundled `dist` is served with origin https://kea.chat so relative /api calls
 * hit production Netlify (same as the website).
 */
const config: CapacitorConfig = {
  appId: 'chat.kea.app',
  appName: 'Kea',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'kea.chat',
    allowNavigation: [
      'kea.chat',
      '*.kea.chat',
      'checkout.stripe.com',
      '*.stripe.com',
      'billing.stripe.com',
      '*.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#060a12',
    },
  },
}

export default config

import { Capacitor } from '@capacitor/core'

/** True when running inside the Capacitor Android/iOS shell. */
export function isKeaNativeApp() {
  return Capacitor.isNativePlatform()
}

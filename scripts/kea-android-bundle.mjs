/**
 * Runs Gradle bundleRelease for the Kea Android app.
 * Requires JDK 21+ and Android SDK. See docs/play-aab.md.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = path.join(root, 'android')
const isWin = process.platform === 'win32'
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew')

const portableJdk = path.join(root, '.kea', 'jdk-21')
const env = { ...process.env }
if (!env.JAVA_HOME && fs.existsSync(path.join(portableJdk, 'bin', 'java.exe'))) {
  env.JAVA_HOME = portableJdk
  env.PATH = `${path.join(portableJdk, 'bin')}${path.delimiter}${env.PATH || ''}`
}
if (!env.ANDROID_HOME) {
  const winSdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  if (fs.existsSync(winSdk)) env.ANDROID_HOME = winSdk
}

if (!fs.existsSync(gradlew)) {
  console.error('Missing android/gradlew — run: npx cap add android')
  process.exit(1)
}

const result = spawnSync(gradlew, ['bundleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
  env,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const aab = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab',
)
if (fs.existsSync(aab)) {
  console.log(`\nAAB ready: ${aab}`)
} else {
  console.log('\nGradle finished — check android/app/build/outputs/bundle/release/')
}

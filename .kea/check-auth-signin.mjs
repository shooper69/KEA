import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const token = fs
  .readFileSync(path.join(root, '.kea', 'supabase-access-token'), 'utf8')
  .replace(/^\uFEFF/, '')
  .trim()
const ref = 'laubnngplqvsxokbfski'
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
})
const json = await res.json()
if (!res.ok) {
  console.error('HTTP', res.status)
  process.exit(1)
}
const keys = [
  'site_url',
  'uri_allow_list',
  'disable_signup',
  'mailer_autoconfirm',
  'external_email_enabled',
  'security_captcha_enabled',
  'security_captcha_provider',
  'password_required_characters',
  'password_min_length',
  'sessions_inactivity_timeout',
  'refresh_token_rotation_enabled',
  'security_manual_linking_enabled',
]
const out = {}
for (const k of keys) out[k] = json[k]
console.log(JSON.stringify(out, null, 2))

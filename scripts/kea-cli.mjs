import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allow = createRequire(import.meta.url)('../kea.cli.json')
const keaDir = path.join(root, '.kea')

const tool = process.argv[2]
const args = process.argv.slice(3)

if (!tool || ['-h', '--help', 'help'].includes(tool)) {
  printHelp()
  process.exit(tool ? 0 : 1)
}

function printHelp() {
  console.log(`Kea CLI wrappers — this repo only. Tokens live in .kea/ (gitignored).
Do not use the default supabase/netlify login; those are other products.

  npm run kea:supabase -- login
      Create a token in the account that owns Kea Production
      (${allow.supabase.dashboard}) and save it as .kea/supabase-access-token

  npm run kea:supabase -- link | projects list | …

  npm run kea:netlify -- login
      Create a Netlify personal token on the Kea Netlify team (not InvesTech,
      not ReMeLifers) and save it as .kea/netlify-auth-token

  npm run kea:netlify -- link | status | …

  npm run kea:github -- auth status | …
      Must be GitHub user ${allow.github.owner}, repo ${allow.github.owner}/${allow.github.repo}
`)
}

function read(rel) {
  const full = path.join(root, rel)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : ''
}

function runGuard() {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'assert-kea-isolation.mjs')],
    { cwd: root, stdio: 'inherit' },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function readToken(filename) {
  const full = path.join(keaDir, filename)
  if (!fs.existsSync(full)) return ''
  return fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').trim()
}

function keaEnv() {
  const env = { ...process.env }
  delete env.SUPABASE_ACCESS_TOKEN
  delete env.NETLIFY_AUTH_TOKEN
  const supabase = readToken('supabase-access-token')
  const netlify = readToken('netlify-auth-token')
  if (supabase) env.SUPABASE_ACCESS_TOKEN = supabase
  if (netlify) env.NETLIFY_AUTH_TOKEN = netlify
  return env
}

function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...keaEnv(), ...extraEnv },
  })
  if (result.error && result.error.code === 'ENOENT') {
    console.error(`Missing ${command}. Install that CLI, then retry via npm run kea:…`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

function capture(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: keaEnv(),
  })
}

function assertSafeArgs(list) {
  const blob = list.join(' ').toLowerCase()
  for (const ref of [...allow.forbidden.supabaseOrgs, ...allow.forbidden.supabaseProjects]) {
    if (blob.includes(ref.toLowerCase())) {
      console.error('Refused: argument points at a non-Kea Supabase project')
      process.exit(1)
    }
  }
  for (const name of allow.forbidden.names) {
    if (blob.includes(name)) {
      console.error(`Refused: argument mentions ${name}`)
      process.exit(1)
    }
  }
}

function pinnedSupabaseArgs(list) {
  const cleaned = []
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '--project-ref') {
      i += 1
      continue
    }
    cleaned.push(list[i])
  }
  const head = cleaned[0]
  if (head === 'link') {
    return [
      'link',
      '--project-ref',
      allow.supabase.projectRef,
      '--yes',
      ...cleaned.slice(1),
    ]
  }
  if (head === 'db' || head === 'migration' || head === 'inspect') {
    const linked = read(path.join('supabase', '.temp', 'project-ref')).trim()
    if (linked !== allow.supabase.projectRef) {
      console.error(
        `Refused: linked project is ${linked || 'none'}, not Kea Production (${allow.supabase.projectRef}).`,
      )
      process.exit(1)
    }
    const hasTarget =
      cleaned.includes('--linked') ||
      cleaned.includes('--local') ||
      cleaned.includes('--db-url')
    return hasTarget ? cleaned : [...cleaned, '--linked']
  }
  if (head && head !== 'projects' && head !== 'orgs') {
    const linked = read(path.join('supabase', '.temp', 'project-ref')).trim()
    if (linked && linked !== allow.supabase.projectRef) {
      console.error(
        `Refused: linked project is ${linked}, not Kea Production (${allow.supabase.projectRef}).`,
      )
      process.exit(1)
    }
    if (!linked) {
      console.error(
        `Link Kea Production first: npm run kea:supabase -- link`,
      )
      process.exit(1)
    }
    console.log(`Using linked Kea Production ${allow.supabase.projectRef}`)
  }
  return cleaned
}

function requireSupabaseToken() {
  if (readToken('supabase-access-token')) return
  console.error(`No Kea Supabase token.
Sign in to the account that owns Kea Production (not another product),
create an access token, and save the token as the only line in:

  ${path.join(keaDir, 'supabase-access-token')}

Dashboard: ${allow.supabase.dashboard}
Tokens:    https://supabase.com/dashboard/account/tokens`)
  process.exit(1)
}

function requireNetlifyToken() {
  if (readToken('netlify-auth-token')) return
  console.error(`No Kea Netlify token.
The machine Netlify login is a different product and will not be used.
Create a personal access token on the Kea Netlify team and save it as:

  ${path.join(keaDir, 'netlify-auth-token')}

https://app.netlify.com/user/applications#personal-access-tokens`)
  process.exit(1)
}

function assertSupabaseIdentity() {
  const result = capture('supabase', ['projects', 'list', '--output', 'json'])
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'supabase projects list failed')
    console.error('The Kea Supabase token cannot list projects. Recreate .kea/supabase-access-token from the Kea Production owner account.')
    process.exit(1)
  }
  let projects = []
  try {
    projects = JSON.parse(result.stdout || '[]')
  } catch {
    console.error('Could not parse supabase projects list')
    process.exit(1)
  }
  const refs = projects.map((item) => item.ref || item.id)
  if (!refs.includes(allow.supabase.projectRef)) {
    console.error(`Refused: token does not include Kea Production (${allow.supabase.projectRef}).`)
    process.exit(1)
  }
}

function assertNetlifyIdentity() {
  const result = capture('netlify', ['status'])
  const text = `${result.stdout || ''}\n${result.stderr || ''}`
  const lowered = text.toLowerCase()
  if (allow.forbidden.names.some((name) => lowered.includes(name))) {
    console.error('Refused: Netlify CLI identity is a non-Kea team or user. Use .kea/netlify-auth-token from the Kea team.')
    process.exit(1)
  }
}

function assertGithubIdentity() {
  const result = capture('gh', ['api', 'user', '--jq', '.login'])
  const login = (result.stdout || '').trim()
  if (result.status !== 0 || login !== allow.github.owner) {
    console.error(`Refused: GitHub CLI is '${login || 'unknown'}', not ${allow.github.owner}.`)
    process.exit(1)
  }
  spawnSync('gh', ['repo', 'set-default', `${allow.github.owner}/${allow.github.repo}`], {
    cwd: root,
    shell: process.platform === 'win32',
    env: keaEnv(),
  })
}

runGuard()
assertSafeArgs(args)

if (tool === 'supabase') {
  if (args[0] === 'login') {
    printHelp()
    requireSupabaseToken()
    assertSupabaseIdentity()
    console.log(`Kea Supabase token can see ${allow.supabase.projectRef}`)
    process.exit(0)
  }
  requireSupabaseToken()
  assertSupabaseIdentity()
  const pinned = pinnedSupabaseArgs(args.length ? args : ['projects', 'list'])
  if (pinned[0] === 'link') {
    console.log(`Linking Kea Production ${allow.supabase.projectRef}`)
  }
  run('supabase', pinned)
}

if (tool === 'netlify') {
  if (args[0] === 'login') {
    printHelp()
    requireNetlifyToken()
    assertNetlifyIdentity()
    console.log(`Kea Netlify token accepted for site ${allow.netlify.siteName}`)
    process.exit(0)
  }
  requireNetlifyToken()
  assertNetlifyIdentity()
  if (args[0] === 'link' && !args.includes('--name') && !args.includes('--id')) {
    run('netlify', ['link', '--name', allow.netlify.siteName, ...args.slice(1)])
  }
  const nameIdx = args.indexOf('--name')
  if (nameIdx !== -1 && args[nameIdx + 1] && args[nameIdx + 1] !== allow.netlify.siteName) {
    console.error(`Refused: Netlify site must be ${allow.netlify.siteName}`)
    process.exit(1)
  }
  run('netlify', args.length ? args : ['status'])
}

if (tool === 'github') {
  const repo = `${allow.github.owner}/${allow.github.repo}`
  assertGithubIdentity()
  if (!args.length) run('gh', ['repo', 'view', repo])
  if (args[0] === 'login' || args[0] === 'auth') {
    run('gh', args[0] === 'login' ? ['auth', 'login', ...args.slice(1)] : args)
  }
  run('gh', ['--repo', repo, ...args])
}

console.error(`Unknown Kea CLI: ${tool}`)
process.exit(1)

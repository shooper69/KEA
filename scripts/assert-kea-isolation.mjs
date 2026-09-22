import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allow = JSON.parse(fs.readFileSync(path.join(root, 'kea.cli.json'), 'utf8'))
const errors = []

function fail(message) {
  errors.push(message)
}

function read(rel) {
  const full = path.join(root, rel)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : ''
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function redactRemote(url) {
  return url.replace(/x-access-token:[^@]+@/i, 'x-access-token:***@')
}

function normalizeGitUrl(url) {
  return url
    .trim()
    .replace(/x-access-token:[^@]+@/i, '')
    .replace(/^https:\/\/[^/@]+@github\.com\//i, 'https://github.com/')
    .replace(/\.git$/i, '')
}

const remotes = git(['remote', '-v'])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [name, url] = line.split(/\s+/)
    return { name, url }
  })

if (process.env.REPOSITORY_URL) {
  remotes.push({ name: 'origin', url: process.env.REPOSITORY_URL })
}

const remoteNames = [...new Set(remotes.map((item) => item.name))]
if (remoteNames.some((name) => name !== 'origin')) {
  fail(`Only the origin remote is allowed. Found: ${remoteNames.join(', ')}`)
}

const allowedOrigins = [
  allow.github.origin,
  allow.github.origin.replace(/\.git$/, ''),
  `git@github.com:${allow.github.owner}/${allow.github.repo}.git`,
  `git@github.com:${allow.github.owner}/${allow.github.repo}`,
  `https://github.com/${allow.github.owner}/${allow.github.repo}`,
].map((item) => normalizeGitUrl(item))

const allowedRepo = `${allow.github.owner}/${allow.github.repo}`.toLowerCase()

for (const remote of remotes) {
  const normalized = normalizeGitUrl(remote.url)
  const repoMatch = normalized.match(/github\.com[/:]([^/]+\/[^/]+)$/i)
  const repo = repoMatch?.[1]?.toLowerCase()
  const ok =
    allowedOrigins.includes(normalized) || repo === allowedRepo
  if (!ok) {
    fail(
      `Git remote ${remote.name} is ${redactRemote(remote.url)}, not ${allow.github.origin}`,
    )
  }
}

const projectIdMatch = read('supabase/config.toml').match(/^project_id\s*=\s*"([^"]+)"/m)
if (!projectIdMatch || projectIdMatch[1] !== allow.supabase.projectRef) {
  fail(
    `supabase/config.toml project_id must be ${allow.supabase.projectRef} (Kea Production)`,
  )
}

const linkedRef = read('supabase/.temp/project-ref').trim()
if (linkedRef && linkedRef !== allow.supabase.projectRef) {
  fail(`Linked Supabase ref is ${linkedRef}, not ${allow.supabase.projectRef}`)
}

const netlifyStatePath = path.join(root, '.netlify', 'state.json')
if (fs.existsSync(netlifyStatePath)) {
  const state = JSON.parse(fs.readFileSync(netlifyStatePath, 'utf8'))
  if (state.siteId === undefined && !state.siteName) {
    fail('.netlify/state.json is present but has no site')
  }
}

const skipScan = new Set([
  'kea.cli.json',
  'scripts/assert-kea-isolation.mjs',
  'scripts/kea-cli.mjs',
  '.cursor/rules/kea-isolation.mdc',
  'AGENTS.md',
  'package-lock.json',
])

const tracked = git(['ls-files']).split(/\r?\n/).filter(Boolean)
const otherSupabase = /https:\/\/([a-z0-9]+)\.supabase\.co/gi
const otherGithubRemote =
  /(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:["'\s]|$)/gi
const forbiddenRefs = [
  ...allow.forbidden.supabaseOrgs,
  ...allow.forbidden.supabaseProjects,
]

for (const rel of tracked) {
  const posix = rel.replaceAll('\\', '/')
  if (skipScan.has(posix) || posix.startsWith('scripts/')) continue
  if (!/\.(ts|tsx|js|mjs|cjs|json|toml|mdc|example|yml|yaml)$/i.test(posix)) {
    continue
  }
  const text = read(rel)
  for (const ref of forbiddenRefs) {
    if (text.includes(ref)) {
      fail(`${rel} contains a non-Kea Supabase id`)
    }
  }
  for (const match of text.matchAll(otherSupabase)) {
    if (match[1] !== allow.supabase.projectRef) {
      fail(`${rel} points at Supabase project ${match[1]}`)
    }
  }
  for (const match of text.matchAll(otherGithubRemote)) {
    const repo = match[1].replace(/\.git$/, '').toLowerCase()
    if (repo !== allowedRepo) {
      fail(`${rel} points at GitHub ${match[1]}`)
    }
  }
}

if (errors.length) {
  console.error('Kea isolation check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Kea isolation ok · GitHub ${allow.github.owner}/${allow.github.repo} · Supabase ${allow.supabase.projectRef} · Netlify ${allow.netlify.siteName}`,
)

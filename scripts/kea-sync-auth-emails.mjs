import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { keaAuthEmails, writeKeaAuthEmailFiles } from './kea-auth-emails.mjs'

writeKeaAuthEmailFiles()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allow = JSON.parse(fs.readFileSync(path.join(root, 'kea.cli.json'), 'utf8'))
const ref = allow.supabase.projectRef

function readToken() {
  const full = path.join(root, '.kea', 'supabase-access-token')
  if (!fs.existsSync(full)) {
    console.error('Missing .kea/supabase-access-token')
    process.exit(1)
  }
  return fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').trim()
}

const payload = {
  mailer_subjects_confirmation: keaAuthEmails.confirmation.subject,
  mailer_templates_confirmation_content: keaAuthEmails.confirmation.html,
  mailer_subjects_invite: keaAuthEmails.invite.subject,
  mailer_templates_invite_content: keaAuthEmails.invite.html,
  mailer_subjects_recovery: keaAuthEmails.recovery.subject,
  mailer_templates_recovery_content: keaAuthEmails.recovery.html,
  mailer_subjects_magic_link: keaAuthEmails.magicLink.subject,
  mailer_templates_magic_link_content: keaAuthEmails.magicLink.html,
  mailer_subjects_email_change: keaAuthEmails.emailChange.subject,
  mailer_templates_email_change_content: keaAuthEmails.emailChange.html,
  mailer_subjects_reauthentication: keaAuthEmails.reauthentication.subject,
  mailer_templates_reauthentication_content: keaAuthEmails.reauthentication.html,
}

const token = readToken()
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})

const json = await res.json()
if (!res.ok) {
  console.error('Auth email update failed', res.status, JSON.stringify(json).slice(0, 800))
  process.exit(1)
}

const flags = json.mailer_templates_custom_contents || {}
const subjects = json.mailer_subjects_custom_contents || {}
console.log(
  JSON.stringify(
    {
      project: ref,
      customTemplates: {
        confirmation: flags.MAILER_TEMPLATES_CONFIRMATION_CONTENT,
        invite: flags.MAILER_TEMPLATES_INVITE_CONTENT,
        recovery: flags.MAILER_TEMPLATES_RECOVERY_CONTENT,
        magicLink: flags.MAILER_TEMPLATES_MAGIC_LINK_CONTENT,
        emailChange: flags.MAILER_TEMPLATES_EMAIL_CHANGE_CONTENT,
        reauthentication: flags.MAILER_TEMPLATES_REAUTHENTICATION_CONTENT,
      },
      customSubjects: {
        confirmation: subjects.MAILER_SUBJECTS_CONFIRMATION,
        invite: subjects.MAILER_SUBJECTS_INVITE,
        recovery: subjects.MAILER_SUBJECTS_RECOVERY,
        magicLink: subjects.MAILER_SUBJECTS_MAGIC_LINK,
        emailChange: subjects.MAILER_SUBJECTS_EMAIL_CHANGE,
        reauthentication: subjects.MAILER_SUBJECTS_REAUTHENTICATION,
      },
      smtpSender: json.smtp_sender_name,
      smtpFrom: json.smtp_admin_email,
      smtpHost: json.smtp_host,
    },
    null,
    2,
  ),
)
